import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  createDeviceSession,
  isDeviceSessionActive,
  touchDeviceSession,
} from '@/app/lib/admin/device-sessions';
import { cleanPermissions, defaultPermissions } from '@/app/lib/admin/permissions';
import {
  setAdminCookie,
  signAdminJwt,
  unauthorized,
  verifyAdminSession,
} from '@/app/lib/admin/session';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function isMissingSessionVersionColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message || '';
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /session_version|schema cache|does not exist/i.test(message)
  );
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

  try {
    const supabase = getSupabaseAdmin();
    let admin: {
      id: string;
      email: string;
      full_name: string | null;
      role: string;
      role_key: string | null;
      permissions: unknown;
      status: string;
      session_version?: number | null;
    } | null = null;

    const withVersion = await supabase
      .from('admins')
      .select('id, email, full_name, role, role_key, permissions, status, session_version')
      .eq('id', session.id)
      .maybeSingle();

    if (isMissingSessionVersionColumn(withVersion.error)) {
      const legacy = await supabase
        .from('admins')
        .select('id, email, full_name, role, role_key, permissions, status')
        .eq('id', session.id)
        .maybeSingle();
      admin = legacy.data;
    } else {
      if (withVersion.error) return unauthorized();
      admin = withVersion.data;
    }

    if (!admin || admin.status !== 'active') return unauthorized();

    const hasVersionColumn = Object.prototype.hasOwnProperty.call(admin, 'session_version');
    const liveVersion =
      typeof admin.session_version === 'number' && Number.isFinite(admin.session_version)
        ? Math.max(0, Math.floor(admin.session_version))
        : 0;

    if (hasVersionColumn && session.sessionVersion !== liveVersion) {
      return unauthorized();
    }

    let sessionId = session.sessionId;
    if (sessionId) {
      const active = await isDeviceSessionActive(session.id, sessionId);
      if (!active) return unauthorized();
      await touchDeviceSession(sessionId, request);
    } else {
      // Legacy cookie without device id — attach this browser as a tracked device.
      sessionId = await createDeviceSession({ adminId: session.id, request });
    }

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
      sessionVersion: hasVersionColumn ? liveVersion : session.sessionVersion,
      sessionId,
    } as const;

    const response = NextResponse.json(next);
    // Keep the cookie aligned with the latest role template so UI + API match after role edits.
    setAdminCookie(response, await signAdminJwt(next));
    return response;
  } catch {
    return NextResponse.json(session);
  }
}
