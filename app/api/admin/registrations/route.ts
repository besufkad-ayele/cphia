import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';
import { deriveAdminStatus, isAdminStatus } from '@/app/lib/admin/status';
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
  review_status: string | null;
  created_at: string;
  ui_language: string | null;
  phone: string | null;
  secondary_phone: string | null;
  fan_number: string | null;
  bank_name: string | null;
  cohort: string | null;
};

function toSummary(row: RegistrationRow): RegistrationSummary {
  return {
    id: row.id,
    registrationId: row.registration_id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    phone: row.phone ?? '',
    secondaryPhone: row.secondary_phone ?? '',
    fanNumber: row.fan_number ?? '',
    sector: row.sector,
    residenceRegion: row.residence_region,
    status: deriveAdminStatus(row.review_status, row.email_status, row.device_flag),
    createdAt: row.created_at,
    uiLanguage: row.ui_language ?? 'en',
    deviceFlag: row.device_flag,
    bankName: row.bank_name ?? '',
    cohort: row.cohort ?? 'CPHIA-26',
  };
}

function sanitizeSearch(value: string) {
  return value.replace(/[,.%()\\]/g, ' ').trim().slice(0, 80);
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

  const url = request.nextUrl;
  const statusParam = url.searchParams.get('status');
  const searchParam = url.searchParams.get('search');
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') || 25)));
  const status = statusParam && isAdminStatus(statusParam) ? statusParam : null;
  const search = searchParam ? sanitizeSearch(searchParam) : '';
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('registrations')
      .select(
        'id, registration_id, first_name, last_name, email, sector, residence_region, email_status, device_flag, review_status, created_at, ui_language, phone, secondary_phone, fan_number, bank_name, cohort',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('review_status', status);

    if (search) {
      query = query.or(
        [
          `first_name.ilike.%${search}%`,
          `last_name.ilike.%${search}%`,
          `email.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
          `secondary_phone.ilike.%${search}%`,
          `fan_number.ilike.%${search}%`,
          `registration_id.ilike.%${search}%`,
        ].join(','),
      );
    }

    const [{ data, error, count }, metricsResult] = await Promise.all([
      query,
      supabase.from('registrations').select('review_status'),
    ]);

    if (error) {
      console.error('admin_registrations_error', error);
      return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
    }

    const metrics = (metricsResult.data ?? []).reduce(
      (acc, row) => {
        const value = deriveAdminStatus(row.review_status);
        acc.total += 1;
        acc[value] += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, review: 0, flagged: 0 },
    );

    return NextResponse.json({
      registrations: (data ?? []).map((row) => toSummary(row as RegistrationRow)),
      metrics,
      page,
      pageSize,
      total: count ?? 0,
    });
  } catch (error) {
    console.error('admin_registrations_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
}
