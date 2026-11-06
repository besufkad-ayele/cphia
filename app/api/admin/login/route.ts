import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cleanPermissions, defaultPermissions } from '@/app/lib/admin/permissions';
import { getSessionSecret, setAdminCookie, signAdminJwt } from '@/app/lib/admin/session';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!getSessionSecret()) {
    return NextResponse.json({ error: 'MISCONFIGURED' }, { status: 500 });
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('verify_admin_login', {
      p_email: email,
      p_password: password,
    });

    if (error) {
      console.error('admin_login_rpc_error', error);
      return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    const admin = Array.isArray(data) ? data[0] : data;
    if (!admin?.id || admin.status !== 'active') {
      return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
    }

    const role = admin.role === 'super_admin' ? 'super_admin' : 'admin';
    const stored = cleanPermissions(admin.permissions);
    const token = await signAdminJwt({
      id: admin.id,
      email: admin.email,
      role,
      fullName: admin.full_name || 'Admin',
      roleKey: typeof admin.role_key === 'string' && admin.role_key ? admin.role_key : role,
      permissions: role === 'super_admin' ? defaultPermissions('super_admin') : stored.length ? stored : defaultPermissions('admin'),
    });
    const response = NextResponse.json({
      ok: true,
      admin: { email: admin.email, role: admin.role, fullName: admin.full_name },
    });
    setAdminCookie(response, token);
    return response;
  } catch (error) {
    console.error('admin_login_error', error);
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }
}
