import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { revokeDeviceSessions } from '@/app/lib/admin/device-sessions';
import { clearAdminCookie, verifyAdminSession } from '@/app/lib/admin/session';

async function finishLogout(request: NextRequest, session: Awaited<ReturnType<typeof verifyAdminSession>>) {
  if (session) {
    if (session.sessionId) {
      await revokeDeviceSessions({
        adminId: session.id,
        sessionIds: [session.sessionId],
      }).catch(() => null);
    }
    await logActivity({
      actor: session,
      action: 'auth.logout',
      summary: `${session.fullName} signed out`,
      entityType: 'admin',
      entityId: session.id,
      metadata: { deviceSessionId: session.sessionId },
      request,
    });
  }
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  await finishLogout(request, session);
  const response = NextResponse.redirect(new URL('/admin/login', request.url));
  clearAdminCookie(response);
  return response;
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  await finishLogout(request, session);
  const response = NextResponse.json({ ok: true });
  clearAdminCookie(response);
  return response;
}
