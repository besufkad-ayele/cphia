import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

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

  if (!name) {
    return NextResponse.json({ error: 'INVALID', message: 'Block name is required.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const patch: Record<string, unknown> = {
      name,
      location,
      notes,
      capacity,
    };
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) patch.start_date = startDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) patch.end_date = endDate;

    const { error } = await supabase.from('ops_shift_blocks').update(patch).eq('id', id);
    if (error) return dbError(error);

    // Optionally push shared fields onto member shifts when requested.
    if (body.applyToShifts) {
      const shiftPatch: Record<string, unknown> = { location, notes, capacity };
      if (body.sectors !== undefined || body.sector !== undefined) {
        const { parseShiftSectors } = await import('@/app/lib/admin/shift-sectors');
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
      summary: `${gate.session.fullName} updated bulk block “${name}”`,
      entityType: 'shift_block',
      entityId: id,
      metadata: patch,
      request,
    });
    return NextResponse.json({ ok: true });
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
