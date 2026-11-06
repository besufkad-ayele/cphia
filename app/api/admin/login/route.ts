import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getAdminCredentials,
  setAdminCookie,
  signAdminJwt,
} from '@/app/lib/admin/session';

export const runtime = 'nodejs';

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const credentials = getAdminCredentials();
  if (!credentials) {
    return NextResponse.json({ error: 'MISCONFIGURED' }, { status: 500 });
  }

  const formData = await request.formData();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!safeEqual(email, credentials.email) || !safeEqual(password, credentials.password)) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  }

  const token = await signAdminJwt(email);
  const response = NextResponse.json({ ok: true });
  setAdminCookie(response, token);
  return response;
}
