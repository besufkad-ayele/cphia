import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { isTeamStatus, sanitizeSearch } from '@/app/lib/admin/ops';
import { isTeamScopedSupervisor, supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function teamPayload(body: Record<string, unknown>) {
  const status = String(body.status ?? 'active');
  return {
    cohort_id: String(body.cohortId ?? ''),
    name: String(body.name ?? '').trim().slice(0, 120),
    code: String(body.code ?? '').trim().slice(0, 40),
    description: String(body.description ?? '').trim().slice(0, 2000),
    supervisor_admin_id: body.supervisorAdminId ? String(body.supervisorAdminId) : null,
    status: isTeamStatus(status) ? status : 'active',
  };
}

export async function GET(request: NextRequest) {
  const gate = await requireCapability(request, 'teams.view');
  if (!gate.ok) return gate.error;

  const cohortId = request.nextUrl.searchParams.get('cohortId') || '';
  const mode = request.nextUrl.searchParams.get('mode');
  const q = sanitizeSearch(request.nextUrl.searchParams.get('q') || '');
  const sector = String(request.nextUrl.searchParams.get('sector') || '').trim();

  try {
    const supabase = getSupabaseAdmin();

    if (mode === 'candidates') {
      let peopleQuery = supabase
        .from('registrations')
        .select('id, registration_id, first_name, middle_name, last_name, sector, email, phone, cohort, review_status')
        .eq('review_status', 'approved')
        .order('first_name', { ascending: true })
        .limit(40);

      if (cohortId) {
        const { data: cohort } = await supabase.from('ops_cohorts').select('code').eq('id', cohortId).maybeSingle();
        if (cohort?.code) peopleQuery = peopleQuery.eq('cohort', cohort.code);
      }
      if (sector) peopleQuery = peopleQuery.ilike('sector', `%${sector}%`);
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        const clauses = [
          `first_name.ilike.%${q}%`,
          `middle_name.ilike.%${q}%`,
          `last_name.ilike.%${q}%`,
          `email.ilike.%${q}%`,
          `registration_id.ilike.%${q}%`,
          `phone.ilike.%${q}%`,
          ...tokens.flatMap((token) => [
            `first_name.ilike.%${token}%`,
            `middle_name.ilike.%${token}%`,
            `last_name.ilike.%${token}%`,
          ]),
        ];
        peopleQuery = peopleQuery.or([...new Set(clauses)].join(','));
      }

      const people = await peopleQuery;
      if (people.error) return dbError(people.error);
      return NextResponse.json({ candidates: people.data ?? [] });
    }

    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);
    let teamsQuery = supabase
      .from('ops_teams')
      .select('id, cohort_id, name, code, description, supervisor_admin_id, status, created_at, ops_cohorts(name, code), ops_team_members(count)')
      .order('created_at', { ascending: false });
    if (cohortId) teamsQuery = teamsQuery.eq('cohort_id', cohortId);
    if (scopedTeamIds) {
      if (!scopedTeamIds.length) {
        return NextResponse.json({ teams: [], cohorts: [], admins: [], scoped: true });
      }
      teamsQuery = teamsQuery.in('id', scopedTeamIds);
    }

    const [teams, cohorts, admins] = await Promise.all([
      teamsQuery,
      supabase.from('ops_cohorts').select('id, name, code').order('name'),
      supabase.from('admins').select('id, full_name, email, status, role_key').eq('status', 'active').order('full_name'),
    ]);
    if (teams.error) return dbError(teams.error);
    if (cohorts.error) return dbError(cohorts.error);

    return NextResponse.json({
      teams: (teams.data ?? []).map((team) => ({
        ...team,
        members: Array.isArray(team.ops_team_members) ? team.ops_team_members[0]?.count ?? 0 : 0,
        ops_team_members: undefined,
      })),
      cohorts: isTeamScopedSupervisor(gate.session) ? [] : cohorts.data ?? [],
      admins: (admins.data ?? []).filter((admin) => !isTeamScopedSupervisor(gate.session) || admin.id === gate.session.id),
      scoped: Boolean(scopedTeamIds),
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireCapability(request, 'teams.create');
  if (!gate.ok) return gate.error;
  const payload = teamPayload(await request.json().catch(() => ({})));
  if (!payload.cohort_id || !payload.name) {
    return NextResponse.json({ error: 'INVALID', message: 'Name and cohort are required.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('ops_teams').insert(payload).select('id').single();
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'DUPLICATE', message: 'That team name already exists on this event.' }, { status: 400 });
      }
      return dbError(error);
    }
    await logActivity({
      actor: gate.session,
      action: 'team.create',
      summary: `${gate.session.fullName} created team “${payload.name}”`,
      entityType: 'team',
      entityId: data.id,
      metadata: payload,
      request,
    });
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
