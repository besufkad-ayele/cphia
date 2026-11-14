import type { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export type DeviceSessionRow = {
  id: string;
  admin_id: string;
  device_label: string;
  user_agent: string;
  ip: string;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

export function clientIp(request?: NextRequest | null) {
  if (!request) return '';
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || '';
  return request.headers.get('x-real-ip') || '';
}

export function deviceLabelFromUserAgent(userAgent: string) {
  const ua = userAgent || '';
  const browser =
    /Edg\//i.test(ua) ? 'Edge'
    : /Chrome\//i.test(ua) && !/Chromium/i.test(ua) ? 'Chrome'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Safari\//i.test(ua) && !/Chrome/i.test(ua) ? 'Safari'
    : /OPR\//i.test(ua) || /Opera/i.test(ua) ? 'Opera'
    : 'Browser';

  const os =
    /iPhone/i.test(ua) ? 'iPhone'
    : /iPad/i.test(ua) ? 'iPad'
    : /Android/i.test(ua) ? 'Android'
    : /Mac OS X/i.test(ua) ? 'Mac'
    : /Windows/i.test(ua) ? 'Windows'
    : /Linux/i.test(ua) ? 'Linux'
    : 'device';

  return `${browser} on ${os}`;
}

function isMissingDeviceSessionsTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  const message = error.message || '';
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /admin_device_sessions|schema cache|does not exist/i.test(message)
  );
}

export async function createDeviceSession(input: {
  adminId: string;
  request?: NextRequest | null;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const userAgent = input.request?.headers.get('user-agent') || '';
    const { data, error } = await supabase
      .from('admin_device_sessions')
      .insert({
        admin_id: input.adminId,
        device_label: deviceLabelFromUserAgent(userAgent),
        user_agent: userAgent.slice(0, 500),
        ip: clientIp(input.request).slice(0, 80),
        last_seen_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    if (error || !data?.id) {
      if (isMissingDeviceSessionsTable(error)) return null;
      console.error('device_session_create_error', error);
      return null;
    }
    return data.id as string;
  } catch (error) {
    console.error('device_session_create_failed', error);
    return null;
  }
}

export async function touchDeviceSession(sessionId: string, request?: NextRequest | null) {
  try {
    const supabase = getSupabaseAdmin();
    const patch: Record<string, string> = { last_seen_at: new Date().toISOString() };
    const ip = clientIp(request);
    if (ip) patch.ip = ip.slice(0, 80);
    const { error } = await supabase
      .from('admin_device_sessions')
      .update(patch)
      .eq('id', sessionId)
      .is('revoked_at', null);
    if (error && !isMissingDeviceSessionsTable(error)) {
      console.error('device_session_touch_error', error);
    }
  } catch (error) {
    console.error('device_session_touch_failed', error);
  }
}

export async function isDeviceSessionActive(adminId: string, sessionId: string) {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('admin_device_sessions')
      .select('id, revoked_at')
      .eq('id', sessionId)
      .eq('admin_id', adminId)
      .maybeSingle();
    if (isMissingDeviceSessionsTable(error)) return true;
    if (error || !data) return false;
    return !data.revoked_at;
  } catch {
    return true;
  }
}

export async function revokeDeviceSessions(input: {
  adminId: string;
  sessionIds?: string[];
  /** Revoke every active device except this one. */
  exceptSessionId?: string | null;
  /** Revoke every active device for this admin. */
  allActive?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();
  let query = supabase
    .from('admin_device_sessions')
    .update({ revoked_at: now })
    .eq('admin_id', input.adminId)
    .is('revoked_at', null);

  if (input.exceptSessionId) {
    query = query.neq('id', input.exceptSessionId);
  } else if (input.sessionIds?.length) {
    query = query.in('id', input.sessionIds);
  } else if (input.allActive) {
    // no extra filter — revoke all active rows for this admin
  } else {
    return { revoked: 0, missingTable: false };
  }

  const { data, error } = await query.select('id');
  if (isMissingDeviceSessionsTable(error)) return { revoked: 0, missingTable: true };
  if (error) throw error;
  return { revoked: data?.length ?? 0, missingTable: false };
}

export async function listActiveDeviceSessions(adminId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('admin_device_sessions')
    .select('id, admin_id, device_label, user_agent, ip, created_at, last_seen_at, revoked_at')
    .eq('admin_id', adminId)
    .is('revoked_at', null)
    .order('last_seen_at', { ascending: false })
    .limit(50);

  if (isMissingDeviceSessionsTable(error)) {
    return { rows: [] as DeviceSessionRow[], missingTable: true };
  }
  if (error) throw error;
  return { rows: (data ?? []) as DeviceSessionRow[], missingTable: false };
}
