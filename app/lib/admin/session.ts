import { SignJWT, jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'cphia_admin_session';
export const ADMIN_SESSION_MAX_AGE = 28800;

export type AdminSession = { email: string };

function getJwtSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export function getAdminCredentials() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim() ?? '';
  const secret = process.env.ADMIN_SESSION_SECRET?.trim() ?? '';

  if (!email || !password || !secret) return null;
  return { email, password, secret };
}

export async function signAdminJwt(email: string): Promise<string> {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('MISSING_ADMIN_SESSION_SECRET');
  }

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(email)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_MAX_AGE}s`)
    .sign(secret);
}

export async function verifyAdminJwt(token: string | undefined): Promise<AdminSession | null> {
  const secret = getJwtSecret();
  if (!secret || !token) return null;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const email = typeof payload.sub === 'string' ? payload.sub.trim().toLowerCase() : '';
    if (!email) return null;
    return { email };
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
