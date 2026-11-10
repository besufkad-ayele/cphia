import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loadAttendanceRows, summarizeAttendance } from '@/app/lib/admin/attendance-query';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { hasCapability } from '@/app/lib/admin/permissions';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function GET(request: NextRequest) {
  const gate = await requireCapability(request, 'attendance.reports');
  if (!gate.ok) return gate.error;

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);

    let blocksQuery = supabase
      .from('ops_shift_blocks')
      .select('id, name, kind, start_date, end_date, location, capacity, cohort_id, team_id, ops_cohorts(name, code), ops_teams(name, code)')
      .order('start_date', { ascending: false });

    if (scopedTeamIds) {
      if (!scopedTeamIds.length) {
        return NextResponse.json({
          canExport: hasCapability(gate.session, 'attendance.reports'),
          blocks: [],
          ungroupedShifts: [],
          scoped: true,
        });
      }
      blocksQuery = blocksQuery.eq('kind', 'ops').in('team_id', scopedTeamIds);
    }

    const { data: blocks, error: blocksError } = await blocksQuery;
    if (blocksError) return dbError(blocksError);

    const blockCards = [];
    for (const block of blocks ?? []) {
      const rows = await loadAttendanceRows(supabase, {
        blockId: block.id,
        verifiedOnly: false,
        scopedTeamIds,
      });
      const summary = summarizeAttendance(rows);
      const shiftRows = await supabase
        .from('ops_shifts')
        .select('id, sheet_status')
        .eq('block_id', block.id);
      if (shiftRows.error) return dbError(shiftRows.error);
      const shifts = shiftRows.data ?? [];
      const verifiedShifts = shifts.filter((shift) => shift.sheet_status === 'verified').length;
      const cohort = one(block.ops_cohorts as { name?: string; code?: string } | { name?: string; code?: string }[] | null);
      const team = one(block.ops_teams as { name?: string; code?: string } | { name?: string; code?: string }[] | null);

      blockCards.push({
        id: block.id,
        name: block.name,
        kind: block.kind,
        startDate: block.start_date,
        endDate: block.end_date,
        location: block.location || '',
        capacity: block.capacity || 0,
        cohortCode: cohort?.code || '',
        cohortName: cohort?.name || '',
        teamName: team?.name || '',
        shiftCount: shifts.length,
        verifiedShifts,
        pendingShifts: shifts.length - verifiedShifts,
        totals: summary.totals,
        averages: summary.averages,
      });
    }

    // Standalone shifts (not in a bulk block) — verified + open so supervisors still see pending work.
    let looseQuery = supabase
      .from('ops_shifts')
      .select('id, name, shift_date, start_time, end_time, kind, sheet_status, team_id, ops_cohorts(code), ops_teams(name)')
      .is('block_id', null)
      .order('shift_date', { ascending: false })
      .limit(40);
    if (scopedTeamIds) {
      looseQuery = looseQuery.eq('kind', 'ops').in('team_id', scopedTeamIds);
    }
    const { data: looseShifts, error: looseError } = await looseQuery;
    if (looseError) return dbError(looseError);

    const ungroupedShifts = (looseShifts ?? []).map((shift) => {
      const cohort = one(shift.ops_cohorts as { code?: string } | { code?: string }[] | null);
      const team = one(shift.ops_teams as { name?: string } | { name?: string }[] | null);
      return {
        id: shift.id,
        name: shift.name,
        shiftDate: shift.shift_date,
        startTime: String(shift.start_time).slice(0, 5),
        endTime: String(shift.end_time).slice(0, 5),
        kind: shift.kind,
        sheetStatus: shift.sheet_status,
        cohortCode: cohort?.code || '',
        teamName: team?.name || '',
      };
    });

    return NextResponse.json({
      canExport: hasCapability(gate.session, 'attendance.reports'),
      blocks: blockCards,
      ungroupedShifts,
      scoped: Boolean(scopedTeamIds),
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
