import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbError, isMissingTable, requireFeature } from '@/app/lib/admin/guard';
import { hasFeature } from '@/app/lib/admin/permissions';
import { buildDemographics, type DemographicsSummary } from '@/app/lib/admin/demographics';
import {
  applyRegistrationFilters,
  parseSector,
  parseSubsector,
  registrationStatusMetrics,
  sectorBreakdown,
} from '@/app/lib/admin/registration-filters';
import { deriveAdminStatus } from '@/app/lib/admin/status';
import type { RegistrationSummary } from '@/app/lib/admin/types';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'dashboard');
  if (!gate.ok) return gate.error;

  const today = request.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const sector = parseSector(request.nextUrl.searchParams.get('sector'));
  const subsector = parseSubsector(request.nextUrl.searchParams.get('subsector'));
  const session = gate.session;
  const filters = { sector, subsector };

  try {
    const supabase = getSupabaseAdmin();
    const metrics = await registrationStatusMetrics(supabase, filters);

    let recent: RegistrationSummary[] = [];
    let breakdown = { sectors: [] as Array<{ name: string; count: number }>, subsectors: [] as Array<{ name: string; count: number }> };
    let demographics: DemographicsSummary = buildDemographics([]);

    if (hasFeature(session, 'volunteers')) {
      let recentQuery = supabase
        .from('registrations')
        .select('id, registration_id, first_name, middle_name, last_name, email, sector, health_subsectors, role_subsectors, residence_region, email_status, device_flag, review_status, review_note, created_at, ui_language, phone, secondary_phone, fan_number, bank_name, cohort')
        .order('created_at', { ascending: false })
        .limit(6);
      recentQuery = applyRegistrationFilters(recentQuery as never, filters) as typeof recentQuery;
      const { data } = await recentQuery;
      recent = (data ?? []).map((row) => {
        const firstName = row.first_name ?? '';
        const middleName = row.middle_name ?? '';
        const lastName = row.last_name ?? '';
        return {
          id: row.id,
          registrationId: row.registration_id,
          firstName,
          middleName,
          lastName,
          name: [firstName, middleName, lastName].filter(Boolean).join(' '),
          email: row.email,
          phone: row.phone ?? '',
          secondaryPhone: row.secondary_phone ?? '',
          fanNumber: row.fan_number ?? '',
          sector: row.sector,
          healthSubsectors: row.health_subsectors ?? [],
          roleSubsectors: row.role_subsectors ?? [],
          residenceRegion: row.residence_region,
          status: deriveAdminStatus(row.review_status, row.email_status, row.device_flag),
          reviewNote: row.review_note ?? '',
          createdAt: row.created_at,
          uiLanguage: row.ui_language ?? 'en',
          deviceFlag: row.device_flag,
          bankName: row.bank_name ?? '',
          cohort: row.cohort ?? 'CPHIA-26',
        };
      });

      let breakdownQuery = supabase
        .from('registrations')
        .select('sector, health_subsectors, role_subsectors, sex, age, education_level');
      breakdownQuery = applyRegistrationFilters(breakdownQuery as never, filters) as typeof breakdownQuery;
      const { data: breakdownRows } = await breakdownQuery;
      breakdown = sectorBreakdown(breakdownRows ?? []);
      demographics = buildDemographics(breakdownRows ?? []);
    }

    let migrationRequired = false;
    let cohorts = 0;
    let shiftsToday = 0;
    let checkedInToday = 0;
    let formsPublished = 0;
    let team = 0;
    let todayBoard: Array<{ id: string; name: string; location: string; start: string; end: string; capacity: number; present: number; cohort: string }> = [];

    const shiftResult = await supabase
      .from('ops_shifts')
      .select('id, name, location, start_time, end_time, capacity, ops_cohorts(code), ops_attendance(status)')
      .eq('shift_date', today)
      .order('start_time', { ascending: true })
      .limit(6);

    if (shiftResult.error && isMissingTable(shiftResult.error)) {
      migrationRequired = true;
    } else if (shiftResult.error) {
      return dbError(shiftResult.error);
    } else {
      const [cohortCount, formCount, teamCount] = await Promise.all([
        supabase.from('ops_cohorts').select('id', { count: 'exact', head: true }).in('status', ['open', 'active']),
        supabase.from('ops_forms').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        hasFeature(session, 'users')
          ? supabase.from('admins').select('id', { count: 'exact', head: true }).eq('status', 'active')
          : Promise.resolve({ count: 0 }),
      ]);
      cohorts = cohortCount.count ?? 0;
      formsPublished = formCount.count ?? 0;
      team = teamCount.count ?? 0;
      shiftsToday = shiftResult.data?.length ?? 0;
      todayBoard = ((shiftResult.data ?? []) as Array<{
        id: string;
        name: string;
        location: string | null;
        start_time: string;
        end_time: string;
        capacity: number;
        ops_attendance: { status?: string }[] | null;
        ops_cohorts: { code?: string } | { code?: string }[] | null;
      }>).map((shift) => {
        const marks = Array.isArray(shift.ops_attendance) ? shift.ops_attendance : [];
        const present = marks.filter((mark) => mark.status === 'present' || mark.status === 'late').length;
        const cohortJoin = shift.ops_cohorts;
        const cohortCode = Array.isArray(cohortJoin) ? cohortJoin[0]?.code : cohortJoin?.code;
        checkedInToday += present;
        return {
          id: shift.id,
          name: shift.name,
          location: shift.location || 'Location not set',
          start: String(shift.start_time).slice(0, 5),
          end: String(shift.end_time).slice(0, 5),
          capacity: shift.capacity,
          present,
          cohort: cohortCode || 'Cohort',
        };
      });
    }

    return NextResponse.json({
      metrics,
      recent,
      breakdown,
      demographics,
      filters: { sector, subsector },
      cohorts,
      shiftsToday,
      checkedInToday,
      formsPublished,
      team,
      todayBoard,
      migrationRequired,
      permissions: session.permissions,
      role: session.role,
    });
  } catch (error) {
    console.error('admin_overview_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
}
