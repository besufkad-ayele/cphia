import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

const ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? 'ayebesufkad@gmail.com').trim().toLowerCase();
const SESSION_SECRET = (process.env.ADMIN_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'cphia-admin-dev-secret').trim();
const SESSION_COOKIE = 'cphia_admin_session';

function signValue(value: string) {
  return createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

function isValidSessionCookie(cookieValue: string | undefined) {
  if (!cookieValue) return false;

  const [email, signature] = cookieValue.split('.');
  if (!email || !signature) return false;

  const expectedSignature = signValue(email);
  if (email.toLowerCase() !== ADMIN_EMAIL) return false;

  const actual = Buffer.from(signature, 'hex');
  const expected = Buffer.from(expectedSignature, 'hex');

  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login' || pathname === '/api/admin/login' || pathname === '/api/admin/logout') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

    if (!isValidSessionCookie(sessionCookie)) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}
