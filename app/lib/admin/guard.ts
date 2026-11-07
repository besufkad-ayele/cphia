import { NextResponse, type NextRequest } from 'next/server';
import {
  hasCapability,
  hasFeature,
  isFeature,
  type FeatureKey,
  type PermissionKey,
} from '@/app/lib/admin/permissions';
import { unauthorized, verifyAdminSession, type AdminSession } from '@/app/lib/admin/session';

export async function requireFeature(request: NextRequest, feature: FeatureKey) {
  const session = await verifyAdminSession(request);
  if (!session) return { ok: false as const, error: unauthorized() };
  if (!hasFeature(session, feature)) {
    return { ok: false as const, error: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export async function requireCapability(request: NextRequest, capability: PermissionKey) {
  const session = await verifyAdminSession(request);
  if (!session) return { ok: false as const, error: unauthorized() };
  if (!hasCapability(session, capability)) {
    return { ok: false as const, error: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) };
  }
  return { ok: true as const, session };
}

export function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message || '';
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(message);
}

export function dbError(error: { code?: string; message?: string } | null | undefined) {
  if (isMissingTable(error)) {
    return NextResponse.json(
      {
        error: 'MIGRATION_REQUIRED',
        message: 'Apply the latest supabase/migrations SQL (through 012_teams_and_shift_kinds.sql), then reload this page.',
      },
      { status: 503 },
    );
  }
  console.error('admin_ops_error', error);
  return NextResponse.json({ error: 'REQUEST_FAILED' }, { status: 500 });
}

export function exceedsAccess(session: AdminSession, permissions: readonly string[]) {
  if (session.role === 'super_admin') return false;
  // Granting a permission the actor does not hold (module or nested detail) is not allowed.
  return permissions.some((key) => {
    if (session.permissions.includes(key as never)) return false;
    const feature = key.split('.')[0];
    if (feature && isFeature(feature) && session.permissions.includes(feature)) {
      // Actor has bare module (legacy full access) → can grant nested details under it.
      const actorHasDetails = session.permissions.some((item) => item.startsWith(`${feature}.`));
      return actorHasDetails;
    }
    return true;
  });
}
