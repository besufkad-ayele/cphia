import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, exceedsAccess, requireCapability } from '@/app/lib/admin/guard';
import { cleanPermissions } from '@/app/lib/admin/permissions';
import { isAssignableDeskRole } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

async function activeSuperAdmins(exceptId?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('admins').select('id', { count: 'exact', head: true }).eq('role', 'super_admin').eq('status', 'active');
  if (exceptId) query = query.neq('id', exceptId);
  const { count } = await query;
  return count ?? 0;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'users.edit');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase.from('admins').select('id, role, status').eq('id', id).maybeSingle();
    if (currentError) return dbError(currentError);
    if (!current) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const { data: role, error } = await supabase.from('ops_roles').select('key, permissions').eq('id', String(body.roleId ?? '')).maybeSingle();
    if (error) return dbError(error);
    if (!role) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (!isAssignableDeskRole(role)) {
      return NextResponse.json(
        { error: 'INVALID', message: 'Zone captain is roster-only and cannot be a desk login.' },
        { status: 400 },
      );
    }
    if (role.key === 'super_admin' && gate.session.role !== 'super_admin') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const permissions = cleanPermissions(role.permissions);
    if (exceedsAccess(gate.session, permissions)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const status = body.status === 'disabled' ? 'disabled' : 'active';
    if (current.role === 'super_admin' && (status === 'disabled' || role.key !== 'super_admin')) {
      const remaining = await activeSuperAdmins(id);
      if (remaining < 1) return NextResponse.json({ error: 'LAST_SUPER_ADMIN' }, { status: 400 });
    }

    const { data, error: updateError } = await supabase.rpc('update_admin_user', {
      p_id: id,
      p_full_name: String(body.fullName ?? ''),
      p_role: role.key === 'super_admin' ? 'super_admin' : 'admin',
      p_role_key: role.key,
      p_permissions: permissions,
      p_status: status,
      p_password: String(body.password ?? ''),
    });
    if (updateError) return dbError(updateError);
    if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
    await logActivity({
      actor: gate.session,
      action: 'user.update',
      summary: `${gate.session.fullName} updated admin account`,
      entityType: 'admin',
      entityId: id,
      metadata: { roleKey: role.key, status },
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'users.delete');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  if (id === gate.session.id) return NextResponse.json({ error: 'SELF' }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: current, error } = await supabase.from('admins').select('role').eq('id', id).maybeSingle();
    if (error) return dbError(error);
    if (!current) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (current.role === 'super_admin') {
      const remaining = await activeSuperAdmins(id);
      if (remaining < 1) return NextResponse.json({ error: 'LAST_SUPER_ADMIN' }, { status: 400 });
    }
    const { error: deleteError } = await supabase.from('admins').delete().eq('id', id);
    if (deleteError) return dbError(deleteError);
    await logActivity({
      actor: gate.session,
      action: 'user.delete',
      summary: `${gate.session.fullName} deleted an admin account`,
      entityType: 'admin',
      entityId: id,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
