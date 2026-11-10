import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loadAttendanceRows, summarizeAttendance } from '@/app/lib/admin/attendance-query';
import { attendanceFiltersFromSearchParams } from '@/app/lib/admin/attendance-report-params';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { hasCapability } from '@/app/lib/admin/permissions';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

/** Cross-block (or filtered) attendance dashboard + by-person / by-sector rollups. */
export async function GET(request: NextRequest) {
  const gate = await requireCapability(request, 'attendance.reports');
  if (!gate.ok) return gate.error;

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);
    const filters = attendanceFiltersFromSearchParams(request.nextUrl.searchParams, {
      verifiedOnly: false,
    });

    const rows = await loadAttendanceRows(supabase, {
      ...filters,
      scopedTeamIds,
    });
    const summary = summarizeAttendance(rows);

    return NextResponse.json({
      canExport: hasCapability(gate.session, 'attendance.reports'),
      filters: {
        fromDate: filters.fromDate || null,
        toDate: filters.toDate || null,
        sector: filters.sector || null,
        healthSubsector: filters.healthSubsector || null,
        periods: filters.periods || [],
        status: filters.status || null,
        kind: filters.kind || null,
        blockId: filters.blockId || null,
        verifiedOnly: filters.verifiedOnly !== false,
        search: filters.search || null,
      },
      totals: summary.totals,
      averages: summary.averages,
      byDay: summary.byDay,
      byShift: summary.byShift,
      byPerson: summary.byPerson,
      bySector: summary.bySector,
      byPeriod: summary.byPeriod,
      markCount: rows.length,
      scoped: Boolean(scopedTeamIds),
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
