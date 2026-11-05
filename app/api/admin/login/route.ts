import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';

const ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? 'ayebesufkad@gmail.com').trim().toLowerCase();
const ADMIN_PASSWORD = (process.env.SUPER_ADMIN_PASSWORD ?? 'beseAye3...').trim();
const SESSION_SECRET = (process.env.ADMIN_SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'cphia-admin-dev-secret').trim();
const SESSION_COOKIE = 'cphia_admin_session';

function signValue(value: string) {
  return createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: 'INVALID_CREDENTIALS' },
      { status: 401 },
    );
  }

  const signedSession = `${email}.${signValue(email)}`;
  const response = NextResponse.redirect(new URL('/admin', request.url));

  response.cookies.set(SESSION_COOKIE, signedSession, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return response;
}
