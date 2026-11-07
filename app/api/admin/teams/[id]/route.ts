import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { isTeamStatus } from '@/app/lib/admin/ops';
import { isTeamScopedSupervisor, supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'teams.view');
  if (!gate.ok) return gate.error;
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const { data: team, error } = await supabase
      .from('ops_teams')
      .select('id, cohort_id, name, code, description, supervisor_admin_id, status, created_at, ops_cohorts(id, name, code)')
      .eq('id', id)
      .maybeSingle();
    if (error) return dbError(error);
    if (!team) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);
    if (scopedTeamIds && !scopedTeamIds.includes(id)) {
      return NextResponse.json({ error: 'FORBIDDEN', message: 'You can only open teams you supervise.' }, { status: 403 });
    }

    const [members, admins, shifts] = await Promise.all([
      supabase
        .from('ops_team_members')
        .select('id, role, registration_id, registrations(id, registration_id, first_name, middle_name, last_name, sector, email, phone, review_status)')
        .eq('team_id', id)
        .order('created_at', { ascending: true }),
      supabase.from('admins').select('id, full_name, email, status, role_key').eq('status', 'active').order('full_name'),
      supabase
        .from('ops_shifts')
        .select('id, name, shift_date, start_time, end_time, kind, sheet_status, capacity')
        .eq('team_id', id)
        .order('shift_date', { ascending: true }),
    ]);
    if (members.error) return dbError(members.error);

    return NextResponse.json({
      team,
      members: (members.data ?? []).map((row) => {
        const person = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
        return {
          id: row.id,
          role: row.role,
          registrationId: row.registration_id,
          person,
        };
      }),
      admins: isTeamScopedSupervisor(gate.session)
        ? (admins.data ?? []).filter((admin) => admin.id === gate.session.id)
        : admins.data ?? [],
      shifts: shifts.data ?? [],
      readOnly: isTeamScopedSupervisor(gate.session),
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'teams.edit');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? 'active');
  const payload = {
    cohort_id: String(body.cohortId ?? ''),
    name: String(body.name ?? '').trim().slice(0, 120),
    code: String(body.code ?? '').trim().slice(0, 40),
    description: String(body.description ?? '').trim().slice(0, 2000),
    supervisor_admin_id: body.supervisorAdminId ? String(body.supervisorAdminId) : null,
    status: isTeamStatus(status) ? status : 'active',
  };
  if (!payload.cohort_id || !payload.name) {
    return NextResponse.json({ error: 'INVALID', message: 'Name and cohort are required.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_teams').update(payload).eq('id', id);
    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'DUPLICATE', message: 'That team name already exists on this event.' }, { status: 400 });
      }
      return dbError(error);
    }
    await logActivity({
      actor: gate.session,
      action: 'team.update',
      summary: `${gate.session.fullName} updated team “${payload.name}”`,
      entityType: 'team',
      entityId: id,
      metadata: payload,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'teams.delete');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_teams').delete().eq('id', id);
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'team.delete',
      summary: `${gate.session.fullName} deleted a floor team`,
      entityType: 'team',
      entityId: id,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
