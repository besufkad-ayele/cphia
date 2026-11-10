import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cleanPermissions, defaultPermissions } from '@/app/lib/admin/permissions';
import {
  setAdminCookie,
  signAdminJwt,
  unauthorized,
  verifyAdminSession,
} from '@/app/lib/admin/session';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

  try {
    const supabase = getSupabaseAdmin();
    const { data: admin } = await supabase
      .from('admins')
      .select('id, email, full_name, role, role_key, permissions, status')
      .eq('id', session.id)
      .maybeSingle();

    if (!admin || admin.status !== 'active') return unauthorized();

    const role = admin.role === 'super_admin' ? 'super_admin' : 'admin';
    const stored = cleanPermissions(admin.permissions);
    const next = {
      id: admin.id,
      email: admin.email,
      role,
      fullName: admin.full_name || 'Admin',
      roleKey: typeof admin.role_key === 'string' && admin.role_key ? admin.role_key : role,
      permissions:
        role === 'super_admin'
          ? defaultPermissions('super_admin')
          : stored.length
            ? stored
            : defaultPermissions('admin'),
    } as const;

    const response = NextResponse.json(next);
    // Keep the cookie aligned with the latest role template so UI + API match after role edits.
    setAdminCookie(response, await signAdminJwt(next));
    return response;
  } catch {
    return NextResponse.json(session);
  }
}
