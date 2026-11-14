import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { revokeDeviceSessions } from '@/app/lib/admin/device-sessions';
import { dbError } from '@/app/lib/admin/guard';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

  const body = await request.json().catch(() => ({}));
  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = [
    ...new Set(
      rawIds
        .map((id: unknown) => String(id ?? '').trim())
        .filter((id: string) => id.length > 0),
    ),
  ] as string[];

  if (!ids.length) {
    return NextResponse.json({ error: 'INVALID', message: 'Select at least one device.' }, { status: 400 });
  }

  // Never revoke the device you are currently using from this endpoint.
  const targets = session.sessionId ? ids.filter((id) => id !== session.sessionId) : ids;
  if (!targets.length) {
    return NextResponse.json(
      { error: 'INVALID', message: 'This device stays signed in. Select other devices to revoke.' },
      { status: 400 },
    );
  }

  try {
    const result = await revokeDeviceSessions({
      adminId: session.id,
      sessionIds: targets,
    });
    if (result.missingTable) {
      return NextResponse.json(
        {
          error: 'MIGRATION_REQUIRED',
          message: 'Apply supabase/migrations/023_admin_device_sessions.sql, then try again.',
        },
        { status: 503 },
      );
    }

    await logActivity({
      actor: session,
      action: 'auth.revoke_devices',
      summary: `${session.fullName} signed out ${result.revoked} other device${result.revoked === 1 ? '' : 's'}`,
      entityType: 'admin',
      entityId: session.id,
      metadata: { revoked: result.revoked, ids: targets },
      request,
    });

    return NextResponse.json({ ok: true, revoked: result.revoked });
  } catch (error) {
    console.error('admin_sessions_revoke_error', error);
    return dbError(error as { message?: string });
  }
}
