import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, exceedsAccess, requireCapability } from '@/app/lib/admin/guard';
import { cleanPermissions } from '@/app/lib/admin/permissions';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function slug(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  return base || `role_${Date.now().toString(36)}`;
}

export async function GET(request: NextRequest) {
  const gate = await requireCapability(request, 'roles.view');
  if (!gate.ok) return gate.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('ops_roles').select('id, key, name, description, permissions, is_system').order('is_system', { ascending: false }).order('name');
    if (error) return dbError(error);
    return NextResponse.json({ roles: data ?? [] });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireCapability(request, 'roles.create');
  if (!gate.ok) return gate.error;
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 80);
  const description = String(body.description ?? '').trim().slice(0, 240);
  const permissions = cleanPermissions(body.permissions);
  if (!name) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  if (exceedsAccess(gate.session, permissions)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });

  try {
    const supabase = getSupabaseAdmin();
    let key = slug(name);
    const { data: existing } = await supabase.from('ops_roles').select('key').like('key', `${key}%`);
    if ((existing ?? []).some((row) => row.key === key)) key = `${key}_${Date.now().toString(36).slice(-4)}`;
    const { data, error } = await supabase.from('ops_roles').insert({ key, name, description, permissions, is_system: false }).select('id').single();
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'role.create',
      summary: `${gate.session.fullName} created role “${name}”`,
      entityType: 'role',
      entityId: data.id,
      metadata: { key, permissions },
      request,
    });
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
