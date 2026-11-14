import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { revokeDeviceSessions } from '@/app/lib/admin/device-sessions';
import { dbError, isMissingTable } from '@/app/lib/admin/guard';
import {
  bumpAdminSessionVersion,
  setAdminCookie,
  signAdminJwt,
  unauthorized,
  verifyAdminSession,
} from '@/app/lib/admin/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

  try {
    const deviceResult = await revokeDeviceSessions(
      session.sessionId
        ? { adminId: session.id, exceptSessionId: session.sessionId }
        : { adminId: session.id, allActive: true },
    );

    // Also bump global version so any legacy cookies without a device id die.
    const nextVersion = await bumpAdminSessionVersion(session.id);
    if (nextVersion === null && deviceResult.missingTable) {
      return NextResponse.json(
        {
          error: 'MIGRATION_REQUIRED',
          message: 'Apply supabase/migrations/021_admin_session_version.sql and 023_admin_device_sessions.sql, then try again.',
        },
        { status: 503 },
      );
    }

    const refreshed = {
      ...session,
      sessionVersion: nextVersion ?? session.sessionVersion,
      sessionId: session.sessionId,
    };
    await logActivity({
      actor: session,
      action: 'auth.revoke_others',
      summary: `${session.fullName} signed out other devices`,
      entityType: 'admin',
      entityId: session.id,
      metadata: {
        sessionVersion: refreshed.sessionVersion,
        revokedDevices: deviceResult.revoked,
      },
      request,
    });

    const response = NextResponse.json({
      ok: true,
      sessionVersion: refreshed.sessionVersion,
      revoked: deviceResult.revoked,
    });
    setAdminCookie(response, await signAdminJwt(refreshed));
    return response;
  } catch (error) {
    if (isMissingTable(error as { code?: string; message?: string })) {
      return dbError(error as { code?: string; message?: string });
    }
    console.error('admin_revoke_others_error', error);
    return NextResponse.json({ error: 'REQUEST_FAILED' }, { status: 500 });
  }
}
