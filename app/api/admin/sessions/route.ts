import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listActiveDeviceSessions } from '@/app/lib/admin/device-sessions';
import { dbError } from '@/app/lib/admin/guard';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

  try {
    const { rows, missingTable } = await listActiveDeviceSessions(session.id);
    if (missingTable) {
      return NextResponse.json(
        {
          error: 'MIGRATION_REQUIRED',
          message: 'Apply supabase/migrations/023_admin_device_sessions.sql, then reload.',
          currentSessionId: session.sessionId,
          count: 0,
          sessions: [],
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      currentSessionId: session.sessionId,
      count: rows.length,
      sessions: rows.map((row) => ({
        id: row.id,
        label: row.device_label || 'Unknown device',
        ip: row.ip || '',
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at,
        current: Boolean(session.sessionId && row.id === session.sessionId),
      })),
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
