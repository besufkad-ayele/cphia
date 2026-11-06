import { NextResponse, type NextRequest } from 'next/server';
import { hasFeature, type FeatureKey } from '@/app/lib/admin/permissions';
import { unauthorized, verifyAdminSession, type AdminSession } from '@/app/lib/admin/session';

export async function requireFeature(request: NextRequest, feature: FeatureKey) {
  const session = await verifyAdminSession(request);
  if (!session) return { ok: false as const, error: unauthorized() };
  if (!hasFeature(session, feature)) {
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
        message: 'Apply supabase/migrations/009_ops_modules.sql, then reload this page.',
      },
      { status: 503 },
    );
  }
  console.error('admin_ops_error', error);
  return NextResponse.json({ error: 'REQUEST_FAILED' }, { status: 500 });
}

export function exceedsAccess(session: AdminSession, permissions: readonly string[]) {
  if (session.role === 'super_admin') return false;
  return permissions.some((key) => !session.permissions.includes(key as FeatureKey));
}
