import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clearAdminCookie } from '@/app/lib/admin/session';

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/admin/login', request.url));
  clearAdminCookie(response);
  return response;
}

export function POST() {
  const response = NextResponse.json({ ok: true });
  clearAdminCookie(response);
  return response;
}
