import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { eachDateInclusive, PERIOD_PRESETS, periodLabel } from '@/app/lib/admin/attendance-columns';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { parseShiftSectors } from '@/app/lib/admin/shift-sectors';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

type PeriodKey = 'morning' | 'afternoon';

function periodOf(startTime: string): PeriodKey {
  return String(startTime).slice(0, 5) < '12:00' ? 'morning' : 'afternoon';
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'shifts.edit');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 160);
  const location = String(body.location ?? '').trim().slice(0, 160);
  const notes = String(body.notes ?? '').trim().slice(0, 1000);
  const capacity = Math.max(0, Number(body.capacity) || 0);
  const startDate = String(body.startDate ?? '');
  const endDate = String(body.endDate ?? '');
  const syncShifts = body.syncShifts !== false;
  const applyToShifts = Boolean(body.applyToShifts);

  if (!name) {
    return NextResponse.json({ error: 'INVALID', message: 'Block name is required.' }, { status: 400 });
  }

  const hasStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const hasEnd = /^\d{4}-\d{2}-\d{2}$/.test(endDate);
  if ((hasStart || hasEnd) && !(hasStart && hasEnd)) {
    return NextResponse.json(
      { error: 'INVALID', message: 'Both from and to dates are required when updating the block range.' },
      { status: 400 },
    );
  }
  if (hasStart && hasEnd && endDate < startDate) {
    return NextResponse.json(
      { error: 'INVALID', message: 'To date must be on or after from date.' },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: block, error: loadError } = await supabase
      .from('ops_shift_blocks')
      .select('id, name, cohort_id, team_id, kind, location, capacity, notes, start_date, end_date')
      .eq('id', id)
      .maybeSingle();
    if (loadError) return dbError(loadError);
    if (!block) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);
    if (scopedTeamIds) {
      if (block.kind !== 'ops' || !block.team_id || !scopedTeamIds.includes(block.team_id)) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Supervisors can only edit bulk blocks for their own team.' },
          { status: 403 },
        );
      }
    }

    const patch: Record<string, unknown> = {
      name,
      location,
      notes,
      capacity,
    };
    if (hasStart) patch.start_date = startDate;
    if (hasEnd) patch.end_date = endDate;

    const { error } = await supabase.from('ops_shift_blocks').update(patch).eq('id', id);
    if (error) return dbError(error);

    let added = 0;
    let removed = 0;

    const { data: existingShifts, error: shiftsError } = await supabase
      .from('ops_shifts')
      .select('id, name, shift_date, start_time, end_time, sector, sectors, location, capacity, notes, sheet_status')
      .eq('block_id', id);
    if (shiftsError) return dbError(shiftsError);

    const shifts = existingShifts ?? [];

    // Sync member shifts to the new date range: add missing day×period slots, remove out-of-range.
    if (syncShifts && hasStart && hasEnd) {
      const datesInRange = new Set(eachDateInclusive(startDate, endDate));
      const outside = shifts.filter((shift) => !datesInRange.has(shift.shift_date));
      if (outside.length) {
        const verifiedLocked = outside.filter((shift) => shift.sheet_status === 'verified');
        if (verifiedLocked.length) {
          return NextResponse.json(
            {
              error: 'LOCKED',
              message: `Cannot shrink this bulk: ${verifiedLocked.length} verified shift${verifiedLocked.length === 1 ? '' : 's'} fall outside ${startDate} → ${endDate}. Reopen those sheets first.`,
            },
            { status: 400 },
          );
        }
        const { data: deleted, error: deleteError } = await supabase
          .from('ops_shifts')
          .delete()
          .in('id', outside.map((shift) => shift.id))
          .select('id');
        if (deleteError) return dbError(deleteError);
        removed = deleted?.length ?? outside.length;
      }

      const remaining = shifts.filter((shift) => datesInRange.has(shift.shift_date));
      const periodTimes: Record<PeriodKey, { startTime: string; endTime: string }> = {
        morning: { ...PERIOD_PRESETS.morning },
        afternoon: { ...PERIOD_PRESETS.afternoon },
      };
      const periods = new Set<PeriodKey>();
      for (const shift of remaining.length ? remaining : shifts) {
        const period = periodOf(String(shift.start_time));
        periods.add(period);
        periodTimes[period] = {
          startTime: String(shift.start_time).slice(0, 5),
          endTime: String(shift.end_time).slice(0, 5),
        };
      }
      if (!periods.size) {
        periods.add('morning');
        periods.add('afternoon');
      }

      const existingKeys = new Set(
        remaining.map((shift) => `${shift.shift_date}:${periodOf(String(shift.start_time))}`),
      );

      let sector = '';
      let sectors: string[] = [];
      if (body.sectors !== undefined || body.sector !== undefined) {
        const parsed = parseShiftSectors(body as Record<string, unknown>);
        sector = parsed.sector;
        sectors = parsed.sectors;
      } else {
        const sample = remaining[0] || shifts[0];
        if (sample) {
          sectors = Array.isArray(sample.sectors)
            ? sample.sectors.map(String).filter(Boolean)
            : String(sample.sector || '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
          sector = sectors.join(', ').slice(0, 160) || String(sample.sector || '');
        }
      }

      const fresh: Array<{
        cohort_id: string;
        name: string;
        shift_date: string;
        start_time: string;
        end_time: string;
        location: string;
        sector: string;
        sectors: string[];
        capacity: number;
        notes: string;
        kind: string;
        team_id: string | null;
        block_id: string;
      }> = [];

      for (const date of eachDateInclusive(startDate, endDate)) {
        for (const period of periods) {
          const key = `${date}:${period}`;
          if (existingKeys.has(key)) continue;
          const times = periodTimes[period];
          fresh.push({
            cohort_id: block.cohort_id,
            name: `${periodLabel(period)} · ${date}`.slice(0, 120),
            shift_date: date,
            start_time: times.startTime,
            end_time: times.endTime,
            location,
            sector,
            sectors,
            capacity,
            notes,
            kind: block.kind,
            team_id: block.kind === 'ops' ? block.team_id : null,
            block_id: id,
          });
        }
      }

      if (fresh.length) {
        if (fresh.length > 60) {
          return NextResponse.json(
            { error: 'INVALID', message: 'Date change would add more than 60 shifts at once. Widen in smaller steps.' },
            { status: 400 },
          );
        }
        const { data: inserted, error: insertError } = await supabase
          .from('ops_shifts')
          .insert(fresh)
          .select('id');
        if (insertError) return dbError(insertError);
        added = inserted?.length ?? fresh.length;
      }
    }

    // Push shared fields onto every remaining / existing shift in the block.
    if (applyToShifts) {
      const shiftPatch: Record<string, unknown> = { location, notes, capacity };
      if (body.sectors !== undefined || body.sector !== undefined) {
        const parsed = parseShiftSectors(body as Record<string, unknown>);
        shiftPatch.sector = parsed.sector;
        shiftPatch.sectors = parsed.sectors;
      }
      const { error: shiftError } = await supabase
        .from('ops_shifts')
        .update(shiftPatch)
        .eq('block_id', id);
      if (shiftError) return dbError(shiftError);
    }

    await logActivity({
      actor: gate.session,
      action: 'shift_block.update',
      summary: `${gate.session.fullName} updated bulk block “${name}”${added || removed ? ` (+${added} / −${removed} shifts)` : ''}`,
      entityType: 'shift_block',
      entityId: id,
      metadata: { ...patch, added, removed },
      request,
    });
    return NextResponse.json({ ok: true, added, removed });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '');

  if (action === 'set_default') {
    const gate = await requireCapability(request, 'attendance.default');
    if (!gate.ok) return gate.error;
    if (gate.session.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Only a superadmin can set the floor default bulk block.' },
        { status: 403 },
      );
    }
    try {
      const supabase = getSupabaseAdmin();
      const { data: block, error } = await supabase
        .from('ops_shift_blocks')
        .select('id, name')
        .eq('id', id)
        .maybeSingle();
      if (error) return dbError(error);
      if (!block) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

      await supabase.from('ops_shift_blocks').update({ is_floor_default: false }).eq('is_floor_default', true);
      const { error: defaultError } = await supabase
        .from('ops_shift_blocks')
        .update({ is_floor_default: true })
        .eq('id', id);
      if (defaultError) return dbError(defaultError);

      await logActivity({
        actor: gate.session,
        action: 'attendance.default_block',
        summary: `${gate.session.fullName} set bulk block “${block.name}” as the floor default`,
        entityType: 'shift_block',
        entityId: id,
        request,
      });
      return NextResponse.json({ ok: true, defaultBlockId: id });
    } catch (error) {
      return dbError(error as { message?: string });
    }
  }

  return NextResponse.json({ error: 'INVALID', message: 'Unknown block action.' }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'shifts.delete');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const mode = request.nextUrl.searchParams.get('mode') || 'with_shifts';
  try {
    const supabase = getSupabaseAdmin();
    const { data: block, error: loadError } = await supabase
      .from('ops_shift_blocks')
      .select('id, name, kind, team_id')
      .eq('id', id)
      .maybeSingle();
    if (loadError) return dbError(loadError);
    if (!block) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);
    if (scopedTeamIds) {
      if (block.kind !== 'ops' || !block.team_id || !scopedTeamIds.includes(block.team_id)) {
        return NextResponse.json(
          { error: 'FORBIDDEN', message: 'Supervisors can only delete bulk blocks for their own team.' },
          { status: 403 },
        );
      }
    }

    let deletedShifts = 0;
    if (mode === 'with_shifts') {
      const { data: removed, error: shiftError } = await supabase
        .from('ops_shifts')
        .delete()
        .eq('block_id', id)
        .select('id');
      if (shiftError) return dbError(shiftError);
      deletedShifts = removed?.length ?? 0;
    } else {
      // Ungroup only: keep shifts as singles.
      const { error: detachError } = await supabase
        .from('ops_shifts')
        .update({ block_id: null })
        .eq('block_id', id);
      if (detachError) return dbError(detachError);
    }

    const { error } = await supabase.from('ops_shift_blocks').delete().eq('id', id);
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'shift_block.delete',
      summary: mode === 'with_shifts'
        ? `${gate.session.fullName} deleted bulk block “${block.name}” and ${deletedShifts} shifts`
        : `${gate.session.fullName} deleted bulk block “${block.name}” (shifts ungrouped)`,
      entityType: 'shift_block',
      entityId: id,
      metadata: { mode, deletedShifts },
      request,
    });
    return NextResponse.json({ ok: true, deletedShifts, mode });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
