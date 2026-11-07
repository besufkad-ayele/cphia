import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminSession } from '@/app/lib/admin/session';

/** Floor supervisors are scoped to teams where they are the assigned supervisor. */
export function isTeamScopedSupervisor(session: Pick<AdminSession, 'role' | 'roleKey'>) {
  if (session.role === 'super_admin') return false;
  return session.roleKey === 'supervisor';
}

export async function supervisedTeamIds(
  supabase: SupabaseClient,
  session: Pick<AdminSession, 'id' | 'role' | 'roleKey'>,
): Promise<string[] | null> {
  if (!isTeamScopedSupervisor(session)) return null;
  const { data, error } = await supabase
    .from('ops_teams')
    .select('id')
    .eq('supervisor_admin_id', session.id)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

export async function assertSupervisorOwnsShift(
  supabase: SupabaseClient,
  session: Pick<AdminSession, 'id' | 'role' | 'roleKey'>,
  shift: { kind?: string | null; team_id?: string | null },
) {
  const teamIds = await supervisedTeamIds(supabase, session);
  if (teamIds === null) return { ok: true as const };
  if (shift.kind !== 'ops' || !shift.team_id || !teamIds.includes(shift.team_id)) {
    return {
      ok: false as const,
      message: 'Supervisors can only open attendance for ops shifts on their own team.',
    };
  }
  return { ok: true as const };
}

/** Roles that exist for labeling / docs and must not be assigned as desk logins. */
export const NON_LOGIN_ROLE_KEYS = new Set(['zone_captain']);

export function isAssignableDeskRole(role: { key: string; permissions?: unknown }) {
  if (NON_LOGIN_ROLE_KEYS.has(role.key)) return false;
  if (role.key === 'super_admin') return true;
  const permissions = Array.isArray(role.permissions) ? role.permissions : [];
  return permissions.length > 0;
}
