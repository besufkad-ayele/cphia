import type { NextRequest } from 'next/server';
import type { AdminSession } from '@/app/lib/admin/session';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export type ActivityInput = {
  actor?: Pick<AdminSession, 'id' | 'email' | 'fullName'> | null;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  request?: NextRequest | null;
  actorEmail?: string;
  actorName?: string;
  /** Volunteer / person this action is about — stored for search. */
  subject?: {
    id?: string | null;
    registrationId?: string | null;
    name?: string | null;
  } | null;
};

function clientIp(request?: NextRequest | null) {
  if (!request) return '';
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || '';
  return request.headers.get('x-real-ip') || '';
}

/** Fire-and-forget activity write. Never throws into the caller. */
export async function logActivity(input: ActivityInput) {
  try {
    const supabase = getSupabaseAdmin();
    const subjectId = String(input.subject?.id || input.entityId || '').slice(0, 120);
    const subjectPublicId = String(input.subject?.registrationId || '').trim().slice(0, 40);
    const subjectName = String(input.subject?.name || '').trim().slice(0, 160);
    const metadata = {
      ...(input.metadata ?? {}),
      ...(subjectId ? { subjectId } : {}),
      ...(subjectPublicId ? { subjectRegistrationId: subjectPublicId } : {}),
      ...(subjectName ? { subjectName } : {}),
    };
    const { error } = await supabase.from('ops_activity_log').insert({
      actor_id: input.actor?.id ?? null,
      actor_email: input.actor?.email || input.actorEmail || '',
      actor_name: input.actor?.fullName || input.actorName || '',
      action: input.action.slice(0, 120),
      entity_type: (input.entityType || '').slice(0, 80),
      entity_id: String(input.entityId || subjectId || '').slice(0, 120),
      summary: input.summary.slice(0, 500),
      metadata,
      request_path: input.request?.nextUrl.pathname?.slice(0, 240) || '',
      ip: clientIp(input.request).slice(0, 80),
    });
    if (error) console.error('activity_log_insert_error', error);
  } catch (error) {
    console.error('activity_log_failed', error);
  }
}

export function activityCategory(action: string) {
  const root = action.split('.')[0] || 'other';
  return root;
}
