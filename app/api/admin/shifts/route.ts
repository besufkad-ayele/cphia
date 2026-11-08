import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  eachDateInclusive,
  PERIOD_PRESETS,
  periodLabel,
} from '@/app/lib/admin/attendance-columns';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { isShiftKind } from '@/app/lib/admin/ops';
import type { AdminSession } from '@/app/lib/admin/session';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function shiftPayload(body: Record<string, unknown>) {
  const kindRaw = String(body.kind ?? 'training');
  const kind = isShiftKind(kindRaw) ? kindRaw : 'training';
  const teamId = body.teamId ? String(body.teamId) : null;
  return {
    cohort_id: String(body.cohortId ?? ''),
    name: String(body.name ?? '').trim().slice(0, 120),
    shift_date: String(body.date ?? ''),
    start_time: String(body.startTime ?? ''),
    end_time: String(body.endTime ?? ''),
    location: String(body.location ?? '').trim().slice(0, 160),
    sector: String(body.sector ?? '').trim().slice(0, 80),
    capacity: Math.max(0, Number(body.capacity) || 0),
    notes: String(body.notes ?? '').trim().slice(0, 1000),
    kind,
    team_id: kind === 'ops' ? teamId : null,
  };
}

type PeriodKey = keyof typeof PERIOD_PRESETS;

export async function GET(request: NextRequest) {
  const gate = await requireCapability(request, 'shifts.view');
  if (!gate.ok) return gate.error;
  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);
    let shiftsQuery = supabase
      .from('ops_shifts')
      .select('id, cohort_id, name, shift_date, start_time, end_time, location, sector, capacity, notes, kind, team_id, sheet_status, ops_cohorts(name, code), ops_teams(name, code), ops_attendance(count)')
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });
    if (scopedTeamIds) {
      if (!scopedTeamIds.length) {
        return NextResponse.json({ shifts: [], cohorts: [], teams: [] });
      }
      shiftsQuery = shiftsQuery.eq('kind', 'ops').in('team_id', scopedTeamIds);
    }

    const [shifts, cohorts, teams] = await Promise.all([
      shiftsQuery,
      supabase.from('ops_cohorts').select('id, name, code').order('name'),
      scopedTeamIds
        ? supabase.from('ops_teams').select('id, name, code, cohort_id, status').in('id', scopedTeamIds).order('name')
        : supabase.from('ops_teams').select('id, name, code, cohort_id, status').eq('status', 'active').order('name'),
    ]);
    if (shifts.error) return dbError(shifts.error);
    if (cohorts.error) return dbError(cohorts.error);

    return NextResponse.json({
      shifts: (shifts.data ?? []).map((shift) => ({
        ...shift,
        marked: Array.isArray(shift.ops_attendance) ? shift.ops_attendance[0]?.count ?? 0 : 0,
        ops_attendance: undefined,
      })),
      cohorts: scopedTeamIds ? [] : cohorts.data ?? [],
      teams: teams.data ?? [],
      scoped: Boolean(scopedTeamIds),
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireCapability(request, 'shifts.create');
  if (!gate.ok) return gate.error;
  const body = await request.json().catch(() => ({}));
  const mode = String((body as { mode?: string }).mode ?? '');

  if (mode === 'bulk') {
    return createBulkShifts(request, gate.session, body as Record<string, unknown>);
  }

  const payload = shiftPayload(body as Record<string, unknown>);
  if (!payload.cohort_id || !payload.name || !payload.shift_date || !payload.start_time || !payload.end_time) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  if (payload.kind === 'ops' && !payload.team_id) {
    return NextResponse.json({ error: 'INVALID', message: 'Ops shifts need a floor team.' }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const ownership = await assertTeamOwnership(supabase, gate.session, payload);
    if (!ownership.ok) return ownership.error;

    const { data, error } = await supabase.from('ops_shifts').insert(payload).select('id').single();
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'shift.create',
      summary: `${gate.session.fullName} created ${payload.kind} shift “${payload.name}”`,
      entityType: 'shift',
      entityId: data.id,
      metadata: payload,
      request,
    });
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

async function assertTeamOwnership(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  session: Pick<AdminSession, 'id' | 'role' | 'roleKey'>,
  payload: ReturnType<typeof shiftPayload>,
) {
  const scopedTeamIds = await supervisedTeamIds(supabase, session);
  if (scopedTeamIds) {
    if (payload.kind !== 'ops' || !payload.team_id || !scopedTeamIds.includes(payload.team_id)) {
      return {
        ok: false as const,
        error: NextResponse.json(
          { error: 'FORBIDDEN', message: 'Supervisors can only create ops shifts for their own team.' },
          { status: 403 },
        ),
      };
    }
  }

  if (payload.team_id) {
    const { data: team, error: teamError } = await supabase
      .from('ops_teams')
      .select('id, cohort_id')
      .eq('id', payload.team_id)
      .maybeSingle();
    if (teamError) return { ok: false as const, error: dbError(teamError) };
    if (!team) {
      return {
        ok: false as const,
        error: NextResponse.json({ error: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 }),
      };
    }
    if (team.cohort_id !== payload.cohort_id) {
      return {
        ok: false as const,
        error: NextResponse.json(
          { error: 'INVALID', message: 'Team must belong to the same event/cohort.' },
          { status: 400 },
        ),
      };
    }
  }

  return { ok: true as const };
}

type BulkSlot = { date: string; period: PeriodKey };

function parseBulkSlots(body: Record<string, unknown>): BulkSlot[] {
  if (Array.isArray(body.slots)) {
    const seen = new Set<string>();
    const slots: BulkSlot[] = [];
    for (const raw of body.slots) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as { date?: unknown; period?: unknown };
      const date = String(row.date ?? '');
      const period = String(row.period ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (period !== 'morning' && period !== 'afternoon') continue;
      const key = `${date}:${period}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({ date, period });
    }
    return slots;
  }

  // Legacy: create every date × period in range.
  const startDate = String(body.startDate ?? '');
  const endDate = String(body.endDate ?? '');
  const rawPeriods = Array.isArray(body.periods) ? body.periods.map(String) : ['morning', 'afternoon'];
  const periods = rawPeriods.filter((item): item is PeriodKey => item === 'morning' || item === 'afternoon');
  return eachDateInclusive(startDate, endDate).flatMap((date) => periods.map((period) => ({ date, period })));
}

async function createBulkShifts(
  request: NextRequest,
  session: AdminSession,
  body: Record<string, unknown>,
) {
  const kindRaw = String(body.kind ?? 'training');
  const kind = isShiftKind(kindRaw) ? kindRaw : 'training';
  const teamId = body.teamId ? String(body.teamId) : null;
  let cohortId = String(body.cohortId ?? '');
  const location = String(body.location ?? '').trim().slice(0, 160);
  const sector = String(body.sector ?? '').trim().slice(0, 80);
  const capacity = Math.max(0, Number(body.capacity) || 0);
  const notes = String(body.notes ?? '').trim().slice(0, 1000);
  const slots = parseBulkSlots(body);
  const slotDates = [...new Set(slots.map((slot) => slot.date))].sort();
  const startDate = String(body.startDate ?? '') || slotDates[0] || '';
  const endDate = String(body.endDate ?? '') || slotDates[slotDates.length - 1] || '';
  const periods = [...new Set(slots.map((slot) => slot.period))];

  if (!slots.length) {
    return NextResponse.json(
      { error: 'INVALID', message: 'Select at least one morning or afternoon shift in the block.' },
      { status: 400 },
    );
  }
  if (slots.length > 60) {
    return NextResponse.json(
      { error: 'INVALID', message: 'Bulk create is limited to 60 shifts at once.' },
      { status: 400 },
    );
  }
  if (kind === 'ops' && !teamId) {
    return NextResponse.json({ error: 'INVALID', message: 'Ops shifts need a floor team.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    if (teamId && !cohortId) {
      const { data: team, error } = await supabase
        .from('ops_teams')
        .select('cohort_id')
        .eq('id', teamId)
        .maybeSingle();
      if (error) return dbError(error);
      cohortId = team?.cohort_id || '';
    }
    if (!cohortId) {
      return NextResponse.json({ error: 'INVALID', message: 'Event / cohort is required.' }, { status: 400 });
    }

    const sample = {
      cohort_id: cohortId,
      name: 'bulk',
      shift_date: slots[0]!.date,
      start_time: '08:00',
      end_time: '12:00',
      location,
      sector,
      capacity,
      notes,
      kind,
      team_id: kind === 'ops' ? teamId : null,
    };
    const ownership = await assertTeamOwnership(supabase, session, sample);
    if (!ownership.ok) return ownership.error;

    const periodNames = periods.map((period) => periodLabel(period)).join(' + ');
    const blockName = String(body.blockName ?? '').trim()
      || `${periodNames} · ${startDate} → ${endDate}`.slice(0, 160);

    const { data: block, error: blockError } = await supabase
      .from('ops_shift_blocks')
      .insert({
        cohort_id: cohortId,
        team_id: kind === 'ops' ? teamId : null,
        kind,
        name: blockName,
        start_date: startDate,
        end_date: endDate,
        location,
        capacity,
        notes,
        created_by: session.id,
      })
      .select('id')
      .single();
    if (blockError) return dbError(blockError);

    const rows = slots.map((slot) => {
      const preset = PERIOD_PRESETS[slot.period];
      const customStart = body[`${slot.period}Start`];
      const customEnd = body[`${slot.period}End`];
      return {
        cohort_id: cohortId,
        name: `${periodLabel(slot.period)} · ${slot.date}`.slice(0, 120),
        shift_date: slot.date,
        start_time: typeof customStart === 'string' && customStart ? customStart : preset.startTime,
        end_time: typeof customEnd === 'string' && customEnd ? customEnd : preset.endTime,
        location,
        sector,
        capacity,
        notes,
        kind,
        team_id: kind === 'ops' ? teamId : null,
        block_id: block.id,
      };
    });

    const { data, error } = await supabase.from('ops_shifts').insert(rows).select('id');
    if (error) return dbError(error);
    await logActivity({
      actor: session,
      action: 'shift.bulk_create',
      summary: `${session.fullName} created block “${blockName}” with ${data?.length ?? rows.length} selected shifts (${startDate} → ${endDate})`,
      entityType: 'shift_block',
      entityId: block.id,
      metadata: {
        blockId: block.id,
        count: data?.length ?? rows.length,
        startDate,
        endDate,
        periods,
        slots,
        kind,
        teamId,
        cohortId,
      },
      request,
    });
    return NextResponse.json({
      created: data?.length ?? rows.length,
      blockId: block.id,
      ids: (data ?? []).map((row) => row.id),
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
