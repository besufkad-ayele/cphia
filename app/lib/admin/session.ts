import { SignJWT, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isDeviceSessionActive } from '@/app/lib/admin/device-sessions';
import { cleanPermissions, defaultPermissions, type PermissionKey } from '@/app/lib/admin/permissions';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const ADMIN_SESSION_COOKIE = 'cphia_admin_session';
export const ADMIN_SESSION_MAX_AGE = 28800;

export type AdminSession = {
  id: string;
  email: string;
  role: 'super_admin' | 'admin';
  fullName: string;
  roleKey: string;
  permissions: PermissionKey[];
  sessionVersion: number;
  /** Per-device session row id — used to revoke selected devices. */
  sessionId: string | null;
};

function getJwtSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || '';
}

function normalizeSessionVersion(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.floor(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return 0;
}

export async function signAdminJwt(admin: AdminSession): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) throw new Error('MISSING_ADMIN_SESSION_SECRET');

  return new SignJWT({
    email: admin.email,
    role: admin.role,
    fullName: admin.fullName,
    roleKey: admin.roleKey,
    permissions: admin.permissions,
    sv: admin.sessionVersion,
    ...(admin.sessionId ? { sid: admin.sessionId } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyAdminJwt(token: string | undefined): Promise<AdminSession | null> {
  const secret = getJwtSecret();
  if (!secret || !token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const id = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    const role = payload.role === 'super_admin' ? 'super_admin' : payload.role === 'admin' ? 'admin' : null;
    const fullName = typeof payload.fullName === 'string' ? payload.fullName : 'Admin';
    if (!id || !email || !role) return null;
    const roleKey = typeof payload.roleKey === 'string' && payload.roleKey ? payload.roleKey : role;
    const stored = cleanPermissions(payload.permissions);
    const permissions = role === 'super_admin' ? defaultPermissions('super_admin') : stored.length ? stored : defaultPermissions('admin');
    const sessionId = typeof payload.sid === 'string' && payload.sid ? payload.sid : null;
    return {
      id,
      email,
      role,
      fullName,
      roleKey,
      permissions,
      sessionVersion: normalizeSessionVersion(payload.sv),
      sessionId,
    };
  } catch {
    return null;
  }
}

function isMissingSessionVersionColumn(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message || '';
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /session_version|schema cache|does not exist/i.test(message)
  );
}

/** JWT + live session_version check so revoked devices cannot keep calling APIs. */
export async function verifyAdminSession(request: NextRequest): Promise<AdminSession | null> {
  const session = await verifyAdminJwt(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) return null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('admins')
      .select('session_version, status')
      .eq('id', session.id)
      .maybeSingle();

    if (isMissingSessionVersionColumn(error)) return session;
    if (error || !data || data.status !== 'active') return null;

    const liveVersion = normalizeSessionVersion(data.session_version);
    if (session.sessionVersion !== liveVersion) return null;

    if (session.sessionId) {
      const active = await isDeviceSessionActive(session.id, session.sessionId);
      if (!active) return null;
    }

    return { ...session, sessionVersion: liveVersion };
  } catch {
    // Env / DB unavailable — keep signature-only auth so local misconfig does not soft-lock the desk.
    return session;
  }
}

export async function bumpAdminSessionVersion(adminId: string): Promise<number | null> {
  const supabase = getSupabaseAdmin();
  const { data: current, error: readError } = await supabase
    .from('admins')
    .select('session_version')
    .eq('id', adminId)
    .maybeSingle();

  if (readError || !current) return null;

  const next = normalizeSessionVersion(current.session_version) + 1;
  const { error: writeError } = await supabase.from('admins').update({ session_version: next }).eq('id', adminId);
  if (writeError) return null;
  return next;
}

export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function setAdminCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, adminCookieOptions(ADMIN_SESSION_MAX_AGE));
}

export function clearAdminCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, '', adminCookieOptions(0));
}

export function unauthorized() {
  const response = NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  clearAdminCookie(response);
  return response;
}
