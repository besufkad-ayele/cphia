import type { AttendanceReportFilters } from '@/app/lib/admin/attendance-query';
import { parseAttendancePeriods } from '@/app/lib/admin/attendance-query';
import { isAttendanceStatus, sanitizeSearch } from '@/app/lib/admin/ops';
import { parseSector, parseSubsector } from '@/app/lib/admin/registration-filters';

/** Shared query-string → attendance report filters (reports UI + export). */
export function attendanceFiltersFromSearchParams(
  params: URLSearchParams,
  defaults?: { verifiedOnly?: boolean },
): Omit<AttendanceReportFilters, 'scopedTeamIds'> {
  const statusRaw = params.get('status') || '';
  const status = isAttendanceStatus(statusRaw) ? statusRaw : '';
  const shiftIds = (params.get('shiftIds') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const verifiedParam = params.get('verifiedOnly');
  const verifiedOnly =
    verifiedParam === '1'
      ? true
      : verifiedParam === '0'
        ? false
        : defaults?.verifiedOnly;

  return {
    fromDate: params.get('from') || undefined,
    toDate: params.get('to') || undefined,
    cohortId: params.get('cohortId') || undefined,
    teamId: params.get('teamId') || undefined,
    status: status || undefined,
    kind: params.get('kind') || undefined,
    search: sanitizeSearch(params.get('q') || '') || undefined,
    blockId: params.get('blockId') || undefined,
    shiftId: params.get('shiftId') || undefined,
    shiftIds: shiftIds.length ? shiftIds : undefined,
    sector: parseSector(params.get('sector')) || undefined,
    healthSubsector: parseSubsector(params.get('subsector')) || undefined,
    periods: parseAttendancePeriods(params.get('period')),
    verifiedOnly,
  };
}
