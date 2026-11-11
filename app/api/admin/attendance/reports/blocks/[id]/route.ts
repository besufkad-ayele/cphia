import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { periodLabel, shiftPeriod } from '@/app/lib/admin/attendance-columns';
import {
  loadApprovedVolunteers,
  loadAttendanceRows,
  summarizeAttendance,
  summarizeTrainingByDay,
} from '@/app/lib/admin/attendance-query';
import { attendanceFiltersFromSearchParams } from '@/app/lib/admin/attendance-report-params';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { hasCapability } from '@/app/lib/admin/permissions';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireCapability(request, 'attendance.reports');
  if (!gate.ok) return gate.error;
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);
    const filters = attendanceFiltersFromSearchParams(request.nextUrl.searchParams, {
      verifiedOnly: false,
    });

    const { data: block, error: blockError } = await supabase
      .from('ops_shift_blocks')
      .select('id, name, kind, start_date, end_date, location, capacity, notes, cohort_id, team_id, ops_cohorts(name, code), ops_teams(name, code)')
      .eq('id', id)
      .maybeSingle();
    if (blockError) return dbError(blockError);
    if (!block) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    if (scopedTeamIds) {
      if (block.kind !== 'ops' || !block.team_id || !scopedTeamIds.includes(block.team_id)) {
        return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
      }
    }

    const { data: shiftRows, error: shiftsError } = await supabase
      .from('ops_shifts')
      .select('id, name, shift_date, start_time, end_time, sheet_status, kind')
      .eq('block_id', id)
      .order('shift_date', { ascending: true })
      .order('start_time', { ascending: true });
    if (shiftsError) return dbError(shiftsError);

    const shifts = (shiftRows ?? []).map((shift) => {
      const period = shiftPeriod(shift.start_time);
      return {
        id: shift.id,
        name: shift.name,
        shiftDate: shift.shift_date,
        startTime: String(shift.start_time).slice(0, 5),
        endTime: String(shift.end_time).slice(0, 5),
        period: periodLabel(period),
        periodKey: period,
        sheetStatus: shift.sheet_status,
        kind: shift.kind,
      };
    });

    // If shiftIds query is present (even empty), honor it. Otherwise default to every sheet in the block.
    const hasShiftIdsParam = request.nextUrl.searchParams.has('shiftIds');
    const selectedFromQuery = hasShiftIdsParam
      ? (filters.shiftIds ?? [])
      : filters.shiftId
        ? [filters.shiftId]
        : shifts.map((shift) => shift.id);
    const allowed = new Set(shifts.map((shift) => shift.id));
    const selectedShiftIds = selectedFromQuery.filter((shiftId) => allowed.has(shiftId));

    const rows = selectedShiftIds.length
      ? await loadAttendanceRows(supabase, {
          ...filters,
          blockId: id,
          shiftId: undefined,
          shiftIds: selectedShiftIds,
          scopedTeamIds,
        })
      : [];
    const approvedPeople = await loadApprovedVolunteers(supabase, {
      sector: filters.sector,
      healthSubsector: filters.healthSubsector,
      search: filters.search,
    });
    const markSummary = summarizeAttendance(rows);
    let daySummary: ReturnType<typeof summarizeTrainingByDay>;
    try {
      daySummary = summarizeTrainingByDay(rows, { approvedPeople });
    } catch {
      daySummary = summarizeTrainingByDay([]);
    }
    const cohort = one(block.ops_cohorts as { name?: string; code?: string } | { name?: string; code?: string }[] | null);
    const team = one(block.ops_teams as { name?: string; code?: string } | { name?: string; code?: string }[] | null);

    return NextResponse.json({
      canExport: hasCapability(gate.session, 'attendance.reports'),
      verifiedOnly: filters.verifiedOnly !== false,
      countingMode: 'day',
      block: {
        id: block.id,
        name: block.name,
        kind: block.kind,
        startDate: block.start_date,
        endDate: block.end_date,
        location: block.location || '',
        capacity: block.capacity || 0,
        notes: block.notes || '',
        cohortCode: cohort?.code || '',
        cohortName: cohort?.name || '',
        teamName: team?.name || '',
      },
      shifts,
      selectedShiftIds,
      // Training dashboard (morning+afternoon → one day; late = present)
      day: {
        totals: daySummary.totals,
        byPerson: daySummary.byPerson ?? [],
        bySector: daySummary.bySector ?? [],
        byDay: daySummary.byDay ?? [],
      },
      // Sheet-level (for opening a single morning/afternoon checklist)
      marks: {
        totals: markSummary.totals,
        byShift: markSummary.byShift,
        byPeriod: markSummary.byPeriod,
      },
      markCount: rows.length,
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
