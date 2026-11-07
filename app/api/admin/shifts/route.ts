import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { isShiftKind } from '@/app/lib/admin/ops';
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
  const payload = shiftPayload(await request.json().catch(() => ({})));
  if (!payload.cohort_id || !payload.name || !payload.shift_date || !payload.start_time || !payload.end_time) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  if (payload.kind === 'ops' && !payload.team_id) {
    return NextResponse.json({ error: 'INVALID', message: 'Ops shifts need a floor team.' }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdmin();
    if (payload.team_id) {
      const { data: team, error: teamError } = await supabase
        .from('ops_teams')
        .select('id, cohort_id')
        .eq('id', payload.team_id)
        .maybeSingle();
      if (teamError) return dbError(teamError);
      if (!team) return NextResponse.json({ error: 'NOT_FOUND', message: 'Team not found.' }, { status: 404 });
      if (team.cohort_id !== payload.cohort_id) {
        return NextResponse.json({ error: 'INVALID', message: 'Team must belong to the same event/cohort.' }, { status: 400 });
      }
    }

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
