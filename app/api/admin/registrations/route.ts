import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';
import { deriveAdminStatus, isAdminStatus, statusFilterClause } from '@/app/lib/admin/status';
import type { RegistrationSummary } from '@/app/lib/admin/types';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

type RegistrationRow = {
  id: string;
  registration_id: string;
  first_name: string;
  last_name: string;
  email: string;
  sector: string;
  residence_region: string;
  email_status: string | null;
  device_flag: string | null;
  created_at: string;
  ui_language: string | null;
  phone: string | null;
};

function toSummary(row: RegistrationRow): RegistrationSummary {
  return {
    id: row.id,
    registrationId: row.registration_id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    sector: row.sector,
    residenceRegion: row.residence_region,
    status: deriveAdminStatus(row.email_status, row.device_flag),
    createdAt: row.created_at,
    uiLanguage: row.ui_language ?? 'en',
    phone: row.phone ?? '',
    deviceFlag: row.device_flag,
  };
}

function sanitizeSearch(value: string) {
  return value.replace(/[,.%()\\]/g, ' ').trim().slice(0, 80);
}

async function metricsFrom(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from('registrations')
    .select('email_status, device_flag');

  if (error || !data) {
    return { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 };
  }

  return data.reduce(
    (acc, row) => {
      const status = deriveAdminStatus(row.email_status, row.device_flag);
      acc.total += 1;
      acc[status] += 1;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 },
  );
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

  const url = request.nextUrl;
  const statusParam = url.searchParams.get('status');
  const searchParam = url.searchParams.get('search');
  const status = statusParam && isAdminStatus(statusParam) ? statusParam : null;
  const search = searchParam ? sanitizeSearch(searchParam) : '';

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('registrations')
      .select('id, registration_id, first_name, last_name, email, sector, residence_region, email_status, device_flag, created_at, ui_language, phone')
      .order('created_at', { ascending: false })
      .limit(100);

    if (status) {
      const filter = statusFilterClause(status);
      query = query.eq(filter.column, filter.value);
      if (status === 'pending') {
        query = query.or('device_flag.is.null,device_flag.eq.none');
      }
    }

    if (search) {
      query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const [{ data, error }, metrics] = await Promise.all([query, metricsFrom(supabase)]);

    if (error) {
      console.error('admin_registrations_error', error);
      return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
    }

    const registrations = (data ?? []).map((row) => toSummary(row as RegistrationRow));
    return NextResponse.json({ registrations, metrics });
  } catch (error) {
    console.error('admin_registrations_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
}
