import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, exceedsAccess, requireFeature } from '@/app/lib/admin/guard';
import { allFeatureKeys, cleanPermissions } from '@/app/lib/admin/permissions';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFeature(request, 'roles');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 80);
  const description = String(body.description ?? '').trim().slice(0, 240);
  const permissions = cleanPermissions(body.permissions);
  if (!name) return NextResponse.json({ error: 'INVALID' }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: role, error } = await supabase.from('ops_roles').select('key, is_system').eq('id', id).maybeSingle();
    if (error) return dbError(error);
    if (!role) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (role.key === 'super_admin' && gate.session.role !== 'super_admin') {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
    const nextPermissions = role.key === 'super_admin' ? allFeatureKeys() : permissions;
    if (exceedsAccess(gate.session, nextPermissions)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

    const { error: updateError } = await supabase.from('ops_roles').update({ name, description, permissions: nextPermissions }).eq('id', id);
    if (updateError) return dbError(updateError);
    if (role.key !== 'super_admin') {
      await supabase.from('admins').update({ permissions: nextPermissions }).eq('role_key', role.key);
    }
    await logActivity({
      actor: gate.session,
      action: 'role.update',
      summary: `${gate.session.fullName} updated role “${name}”`,
      entityType: 'role',
      entityId: id,
      metadata: { key: role.key, permissions: nextPermissions },
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFeature(request, 'roles');
  if (!gate.ok) return gate.error;
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const { data: role, error } = await supabase.from('ops_roles').select('key, is_system').eq('id', id).maybeSingle();
    if (error) return dbError(error);
    if (!role) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (role.is_system || role.key === 'super_admin') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    const { count } = await supabase.from('admins').select('id', { count: 'exact', head: true }).eq('role_key', role.key);
    if ((count ?? 0) > 0) return NextResponse.json({ error: 'ROLE_IN_USE' }, { status: 400 });
    const { error: deleteError } = await supabase.from('ops_roles').delete().eq('id', id);
    if (deleteError) return dbError(deleteError);
    await logActivity({
      actor: gate.session,
      action: 'role.delete',
      summary: `${gate.session.fullName} deleted role “${role.key}”`,
      entityType: 'role',
      entityId: id,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
