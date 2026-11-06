import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireFeature } from '@/app/lib/admin/guard';
import {
  applyRegistrationFilters,
  parseSector,
  parseSubsector,
  registrationStatusMetrics,
  sanitizeSearch,
} from '@/app/lib/admin/registration-filters';
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
  health_subsectors: string[] | null;
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
    healthSubsectors: row.health_subsectors ?? [],
    residenceRegion: row.residence_region,
    status: deriveAdminStatus(row.review_status, row.email_status, row.device_flag),
    createdAt: row.created_at,
    uiLanguage: row.ui_language ?? 'en',
    deviceFlag: row.device_flag,
    bankName: row.bank_name ?? '',
    cohort: row.cohort ?? 'CPHIA-26',
  };
}

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  const url = request.nextUrl;
  const statusParam = url.searchParams.get('status');
  const searchParam = url.searchParams.get('search');
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get('pageSize') || 25)));
  const status = statusParam && isAdminStatus(statusParam) ? statusParam : null;
  const search = searchParam ? sanitizeSearch(searchParam) : '';
  const sector = parseSector(url.searchParams.get('sector'));
  const subsector = parseSubsector(url.searchParams.get('subsector'));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const filters = { status, search, sector, subsector };

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('registrations')
      .select(
        'id, registration_id, first_name, last_name, email, sector, health_subsectors, residence_region, email_status, device_flag, review_status, created_at, ui_language, phone, secondary_phone, fan_number, bank_name, cohort',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    query = applyRegistrationFilters(query as never, filters) as typeof query;

    const [{ data, error, count }, metrics] = await Promise.all([
      query,
      registrationStatusMetrics(supabase, { search, sector, subsector }),
    ]);

    if (error) {
      console.error('admin_registrations_error', error);
      return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
    }

    return NextResponse.json({
      registrations: (data ?? []).map((row) => toSummary(row as RegistrationRow)),
      metrics,
      page,
      pageSize,
      total: count ?? 0,
      filters: { sector, subsector, status, search },
    });
  } catch (error) {
    console.error('admin_registrations_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
}
