import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { clearAdminCookie, verifyAdminSession } from '@/app/lib/admin/session';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (session) {
    await logActivity({
      actor: session,
      action: 'auth.logout',
      summary: `${session.fullName} signed out`,
      entityType: 'admin',
      entityId: session.id,
      request,
    });
  }
  const response = NextResponse.redirect(new URL('/admin/login', request.url));
  clearAdminCookie(response);
  return response;
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (session) {
    await logActivity({
      actor: session,
      action: 'auth.logout',
      summary: `${session.fullName} signed out`,
      entityType: 'admin',
      entityId: session.id,
      request,
    });
  }
  const response = NextResponse.json({ ok: true });
  clearAdminCookie(response);
  return response;
}
