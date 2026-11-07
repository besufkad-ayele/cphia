import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { isTeamMemberRole } from '@/app/lib/admin/ops';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'teams.members');
  if (!gate.ok) return gate.error;
  const { id: teamId } = await params;
  const body = await request.json().catch(() => ({}));
  const registrationIds: string[] = Array.isArray(body.registrationIds)
    ? body.registrationIds.map((value: unknown) => String(value)).filter(Boolean).slice(0, 200)
    : body.registrationId
      ? [String(body.registrationId)]
      : [];
  const roleRaw = String(body.role ?? 'member');
  const role = isTeamMemberRole(roleRaw) ? roleRaw : 'member';

  if (!registrationIds.length) {
    return NextResponse.json({ error: 'INVALID', message: 'Pick at least one volunteer.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: team, error: teamError } = await supabase.from('ops_teams').select('id, name').eq('id', teamId).maybeSingle();
    if (teamError) return dbError(teamError);
    if (!team) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data: approved, error: approvedError } = await supabase
      .from('registrations')
      .select('id')
      .in('id', registrationIds)
      .eq('review_status', 'approved');
    if (approvedError) return dbError(approvedError);
    const allowed = new Set((approved ?? []).map((row) => row.id as string));
    const rows: Array<{ team_id: string; registration_id: string; role: typeof role }> = registrationIds
      .filter((registrationId: string) => allowed.has(registrationId))
      .map((registrationId: string) => ({ team_id: teamId, registration_id: registrationId, role }));

    if (!rows.length) {
      return NextResponse.json({ error: 'NOT_APPROVED', message: 'Only approved volunteers can join a team.' }, { status: 400 });
    }

    const { error } = await supabase.from('ops_team_members').upsert(rows, {
      onConflict: 'team_id,registration_id',
      ignoreDuplicates: false,
    });
    if (error) return dbError(error);

    // Upsert with role update: PostgREST upsert may not update role on conflict depending on config.
    // Explicitly set role for each id to keep zone_captain promotions working.
    await Promise.all(
      rows.map((row: { team_id: string; registration_id: string; role: typeof role }) =>
        supabase
          .from('ops_team_members')
          .update({ role: row.role })
          .eq('team_id', teamId)
          .eq('registration_id', row.registration_id),
      ),
    );

    await logActivity({
      actor: gate.session,
      action: 'team.members.add',
      summary: `${gate.session.fullName} added ${rows.length} volunteer(s) to “${team.name}”`,
      entityType: 'team',
      entityId: teamId,
      metadata: { count: rows.length, role },
      request,
    });
    return NextResponse.json({ ok: true, added: rows.length });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'teams.members');
  if (!gate.ok) return gate.error;
  const { id: teamId } = await params;
  const body = await request.json().catch(() => ({}));
  const memberId = String(body.memberId ?? '');
  const roleRaw = String(body.role ?? '');
  if (!memberId || !isTeamMemberRole(roleRaw)) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('ops_team_members')
      .update({ role: roleRaw })
      .eq('id', memberId)
      .eq('team_id', teamId);
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'team.member.role',
      summary: `${gate.session.fullName} set a team member role to ${roleRaw}`,
      entityType: 'team',
      entityId: teamId,
      metadata: { memberId, role: roleRaw },
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'teams.members');
  if (!gate.ok) return gate.error;
  const { id: teamId } = await params;
  const memberId = request.nextUrl.searchParams.get('memberId') || '';
  if (!memberId) return NextResponse.json({ error: 'INVALID' }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_team_members').delete().eq('id', memberId).eq('team_id', teamId);
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'team.members.remove',
      summary: `${gate.session.fullName} removed a volunteer from a floor team`,
      entityType: 'team',
      entityId: teamId,
      metadata: { memberId },
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
