import { SignJWT, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'cphia_admin_session';
export const ADMIN_SESSION_MAX_AGE = 28800;

export type AdminSession = {
  id: string;
  email: string;
  role: 'super_admin' | 'admin';
  fullName: string;
};

function getJwtSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() || '';
}

export async function signAdminJwt(admin: AdminSession): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) throw new Error('MISSING_ADMIN_SESSION_SECRET');

  return new SignJWT({
    email: admin.email,
    role: admin.role,
    fullName: admin.fullName,
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
    return { id, email, role, fullName };
  } catch {
    return null;
  }
}

export async function verifyAdminSession(request: NextRequest): Promise<AdminSession | null> {
  return verifyAdminJwt(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
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
