import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbError, exceedsAccess, requireFeature } from '@/app/lib/admin/guard';
import { cleanPermissions } from '@/app/lib/admin/permissions';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'users');
  if (!gate.ok) return gate.error;

  try {
    const supabase = getSupabaseAdmin();
    const [{ data, error }, roles] = await Promise.all([
      supabase.from('admins').select('id, email, full_name, role, status, role_key, permissions, created_at').order('created_at', { ascending: true }),
      supabase.from('ops_roles').select('id, key, name, description, permissions, is_system').order('name', { ascending: true }),
    ]);
    if (error) return dbError(error);
    if (roles.error) return dbError(roles.error);
    return NextResponse.json({
      users: data ?? [],
      roles: (roles.data ?? []).filter((role) => gate.session?.role === 'super_admin' || role.key !== 'super_admin'),
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireFeature(request, 'users');
  if (!gate.ok) return gate.error;

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? '').trim().toLowerCase();
  const fullName = String(body.fullName ?? '').trim();
  const password = String(body.password ?? '');
  const roleId = String(body.roleId ?? '');
  if (!email.includes('@') || !fullName || !roleId) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: role, error } = await supabase.from('ops_roles').select('key, permissions').eq('id', roleId).maybeSingle();
    if (error) return dbError(error);
    if (!role) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (role.key === 'super_admin' && gate.session.role !== 'super_admin') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const permissions = cleanPermissions(role.permissions);
    if (exceedsAccess(gate.session, permissions)) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const { data, error: createError } = await supabase.rpc('create_admin_user', {
      p_email: email,
      p_password: password,
      p_full_name: fullName,
      p_role: role.key === 'super_admin' ? 'super_admin' : 'admin',
      p_role_key: role.key,
      p_permissions: permissions,
      p_created_by: gate.session.id,
    });
    if (createError) return dbError(createError);
    if (data?.error) return NextResponse.json({ error: data.error }, { status: 400 });
    return NextResponse.json({ id: data?.id });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
