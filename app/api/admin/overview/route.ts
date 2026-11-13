import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbError, isMissingTable, requireFeature } from '@/app/lib/admin/guard';
import { hasFeature } from '@/app/lib/admin/permissions';
import { buildDemographics, type DemographicsSummary } from '@/app/lib/admin/demographics';
import {
  capacityGap,
  localDateParam,
  localTimeParam,
  shiftMatchesSectorFilter,
  shiftPhase,
  shiftSectorLabel,
  sortFloorShifts,
  summarizeMarks,
  uniqueCheckedInPeople,
  type FloorMark,
} from '@/app/lib/admin/floor-board';
import {
  applyRegistrationFilters,
  fetchAllPaged,
  parseSector,
  parseSubsector,
  registrationStatusMetrics,
  sectorBreakdown,
} from '@/app/lib/admin/registration-filters';
import { deriveAdminStatus } from '@/app/lib/admin/status';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import type { RegistrationSummary } from '@/app/lib/admin/types';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'dashboard');
  if (!gate.ok) return gate.error;

  const today = localDateParam(request.nextUrl.searchParams.get('date'));
  const time = localTimeParam(request.nextUrl.searchParams.get('time'));
  const sector = parseSector(request.nextUrl.searchParams.get('sector'));
  const subsector = parseSubsector(request.nextUrl.searchParams.get('subsector'));
  const session = gate.session;
  const filters = { sector, subsector };

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, session);
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

      const { rows: breakdownRows } = await fetchAllPaged<{
        sector: string | null;
        health_subsectors?: string[] | null;
        role_subsectors?: string[] | null;
        sex?: string | null;
        age?: number | null;
        education_level?: string | null;
      }>(() => {
        let breakdownQuery = supabase
          .from('registrations')
          .select('sector, health_subsectors, role_subsectors, sex, age, education_level', {
            count: 'exact',
          });
        breakdownQuery = applyRegistrationFilters(breakdownQuery as never, filters) as typeof breakdownQuery;
        return breakdownQuery as never;
      });
      breakdown = sectorBreakdown(breakdownRows);
      demographics = buildDemographics(breakdownRows);
    }

    let migrationRequired = false;
    let cohorts = 0;
    let shiftsToday = 0;
    let checkedInToday = 0;
    let liveShifts = 0;
    let capacityGapTotal = 0;
    let formsPublished = 0;
    let team = 0;
    let todayBoard: Array<{
      id: string;
      name: string;
      location: string;
      start: string;
      end: string;
      capacity: number;
      present: number;
      late: number;
      gap: number;
      phase: 'live' | 'upcoming' | 'ended';
      sectorLabel: string;
      cohort: string;
    }> = [];

    let shiftsQuery = supabase
      .from('ops_shifts')
      .select('id, name, location, start_time, end_time, capacity, sector, sectors, kind, team_id, ops_cohorts(code), ops_attendance(status, registration_id)')
      .eq('shift_date', today)
      .order('start_time', { ascending: true });

    const emptyFloorScope = Boolean(scopedTeamIds && !scopedTeamIds.length);
    if (scopedTeamIds?.length) {
      shiftsQuery = shiftsQuery.eq('kind', 'ops').in('team_id', scopedTeamIds);
    }

    const shiftResult = emptyFloorScope
      ? { data: [] as never[], error: null }
      : await shiftsQuery;

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

      const allMarks: FloorMark[] = [];
      const mapped = ((shiftResult.data ?? []) as Array<{
        id: string;
        name: string;
        location: string | null;
        start_time: string;
        end_time: string;
        capacity: number;
        sector?: string | null;
        sectors?: string[] | null;
        ops_attendance: FloorMark[] | null;
        ops_cohorts: { code?: string } | { code?: string }[] | null;
      }>)
        .filter((shift) => shiftMatchesSectorFilter(shift, sector))
        .map((shift) => {
          const marks = Array.isArray(shift.ops_attendance) ? shift.ops_attendance : [];
          allMarks.push(...marks);
          const counts = summarizeMarks(marks);
          const gap = capacityGap(shift.capacity || 0, counts.checkedIn);
          const phase = shiftPhase(shift.start_time, shift.end_time, time);
          const cohortJoin = one(shift.ops_cohorts);
          return {
            id: shift.id,
            name: shift.name,
            location: shift.location || 'Location not set',
            start: String(shift.start_time).slice(0, 5),
            end: String(shift.end_time).slice(0, 5),
            capacity: shift.capacity || 0,
            present: counts.checkedIn,
            late: counts.late,
            gap,
            phase,
            sectorLabel: shiftSectorLabel(shift),
            cohort: cohortJoin?.code || 'Cohort',
          };
        });

      const ordered = sortFloorShifts(mapped);
      shiftsToday = ordered.length;
      liveShifts = ordered.filter((shift) => shift.phase === 'live').length;
      capacityGapTotal = ordered.reduce((sum, shift) => sum + shift.gap, 0);
      checkedInToday = uniqueCheckedInPeople(allMarks);
      // Prefer live + upcoming on the dashboard strip; fall back to ended if the day is over.
      const preferred = ordered.filter((shift) => shift.phase !== 'ended');
      todayBoard = (preferred.length ? preferred : ordered).slice(0, 8);
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
      liveShifts,
      capacityGapTotal,
      formsPublished,
      team,
      todayBoard,
      migrationRequired,
      permissions: session.permissions,
      role: session.role,
      date: today,
      time,
    });
  } catch (error) {
    console.error('admin_overview_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
}
