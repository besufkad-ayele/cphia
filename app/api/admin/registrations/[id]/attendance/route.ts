import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { sectorsMatch } from '@cphia/shared/constants';
import { periodLabel, shiftPeriod } from '@/app/lib/admin/attendance-columns';
import { dbError } from '@/app/lib/admin/guard';
import { hasFeature } from '@/app/lib/admin/permissions';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';
import { listedShiftSectors, shiftAppliesToSector } from '@/app/lib/admin/shift-sectors';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const UNGROUPED = 'ungrouped';

type ShiftRow = {
  id: string;
  name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  kind: string;
  team_id: string | null;
  block_id: string | null;
  sheet_status: string | null;
  location: string | null;
  sector?: string | null;
  sectors?: string[] | null;
  ops_cohorts: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
  ops_teams: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
};

type MarkRow = {
  id: string;
  status: string;
  notes: string | null;
  checked_in_at: string | null;
  updated_at: string | null;
  shift_id: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapShiftRow(shift: ShiftRow, mark: MarkRow | null) {
  const cohort = one(shift.ops_cohorts);
  const team = one(shift.ops_teams);
  const period = shiftPeriod(shift.start_time);
  return {
    id: mark?.id || `pending:${shift.id}`,
    status: mark?.status || 'not_marked',
    notes: mark?.notes || '',
    checkedInAt: mark?.checked_in_at || null,
    updatedAt: mark?.updated_at || null,
    hasMark: Boolean(mark),
    shiftId: shift.id,
    shiftName: shift.name || '',
    shiftDate: shift.shift_date || '',
    startTime: shift.start_time ? String(shift.start_time).slice(0, 5) : '',
    endTime: shift.end_time ? String(shift.end_time).slice(0, 5) : '',
    period,
    periodLabel: periodLabel(period),
    kind: shift.kind || '',
    sheetStatus: shift.sheet_status || '',
    location: shift.location || '',
    teamName: team?.name || '',
    cohortCode: cohort?.code || '',
    cohortName: cohort?.name || '',
    blockId: shift.block_id || null,
    sectors: listedShiftSectors(shift),
  };
}

function sortAttendanceRows<T extends {
  shiftDate: string;
  period: string;
  startTime: string;
  shiftName: string;
}>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const byDate = a.shiftDate.localeCompare(b.shiftDate);
    if (byDate) return byDate;
    const periodRank = (period: string) => (period === 'afternoon' ? 1 : 0);
    const byPeriod = periodRank(a.period) - periodRank(b.period);
    if (byPeriod) return byPeriod;
    return a.startTime.localeCompare(b.startTime) || a.shiftName.localeCompare(b.shiftName);
  });
}

function summarize(rows: Array<{ status: string }>) {
  return {
    total: rows.length,
    present: rows.filter((row) => row.status === 'present').length,
    late: rows.filter((row) => row.status === 'late').length,
    absent: rows.filter((row) => row.status === 'absent').length,
    excused: rows.filter((row) => row.status === 'excused').length,
    notMarked: rows.filter((row) => row.status === 'not_marked').length,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();
  const canVolunteers = hasFeature(session, 'volunteers');
  const canAttendance = hasFeature(session, 'attendance');
  if (!canVolunteers && !canAttendance) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await params;
  const verifiedOnly = request.nextUrl.searchParams.get('verifiedOnly') !== '0';
  const requestedBlockId = String(request.nextUrl.searchParams.get('blockId') || '').trim();

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, session);

    const { data: volunteer, error: volunteerError } = await supabase
      .from('registrations')
      .select('id, sector, health_subsectors, role_subsectors')
      .eq('id', id)
      .maybeSingle();
    if (volunteerError) return dbError(volunteerError);
    if (!volunteer) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const volunteerSector = String(volunteer.sector || '').trim();
    const volunteerPayload = {
      sector: volunteerSector,
      healthSubsectors: volunteer.health_subsectors ?? [],
      roleSubsectors: volunteer.role_subsectors ?? [],
    };

    if (scopedTeamIds && !scopedTeamIds.length) {
      return NextResponse.json({
        rows: [],
        summary: summarize([]),
        verifiedOnly,
        blocks: [],
        defaultBlockId: null,
        selectedBlockId: '',
        volunteer: volunteerPayload,
      });
    }

    // Existing marks (used for block relevance + ungrouped fallback).
    let marksQuery = supabase
      .from('ops_attendance')
      .select(`
        id,
        status,
        notes,
        checked_in_at,
        updated_at,
        shift_id,
        ops_shifts!inner(
          id,
          block_id,
          kind,
          team_id,
          sheet_status
        )
      `)
      .eq('registration_id', id);

    if (verifiedOnly) {
      marksQuery = marksQuery.eq('ops_shifts.sheet_status', 'verified');
    }
    if (scopedTeamIds) {
      marksQuery = marksQuery.eq('ops_shifts.kind', 'ops').in('ops_shifts.team_id', scopedTeamIds);
    }

    const { data: markData, error: markError } = await marksQuery;
    if (markError) return dbError(markError);

    const markBlockIds = new Set<string>();
    const markedShiftIds = new Set<string>();
    let hasUngroupedMarks = false;
    const marksByShiftId = new Map<string, MarkRow>();
    for (const row of markData ?? []) {
      const shift = one(row.ops_shifts as { id: string; block_id: string | null } | { id: string; block_id: string | null }[] | null);
      const blockId = shift?.block_id || null;
      if (blockId) markBlockIds.add(blockId);
      else hasUngroupedMarks = true;
      markedShiftIds.add(row.shift_id);
      marksByShiftId.set(row.shift_id, {
        id: row.id,
        status: row.status,
        notes: row.notes,
        checked_in_at: row.checked_in_at,
        updated_at: row.updated_at,
        shift_id: row.shift_id,
      });
    }

    let blocksQuery = supabase
      .from('ops_shift_blocks')
      .select('id, name, kind, start_date, end_date, location, is_floor_default, team_id')
      .order('start_date', { ascending: false });
    if (scopedTeamIds) {
      blocksQuery = blocksQuery.eq('kind', 'ops').in('team_id', scopedTeamIds);
    }
    const { data: allBlocks, error: blocksError } = await blocksQuery;
    if (blocksError) return dbError(blocksError);

    const blockIds = (allBlocks ?? []).map((block) => block.id);
    type BlockSectorInfo = {
      openToAll: boolean;
      sectors: string[];
      applicableShiftCount: number;
      totalShiftCount: number;
    };
    const sectorByBlock = new Map<string, BlockSectorInfo>();
    if (blockIds.length) {
      const { data: blockShifts, error: shiftError } = await supabase
        .from('ops_shifts')
        .select('id, block_id, sector, sectors, sheet_status')
        .in('block_id', blockIds);
      if (shiftError) return dbError(shiftError);
      for (const shift of blockShifts ?? []) {
        if (!shift.block_id) continue;
        if (verifiedOnly && shift.sheet_status !== 'verified') continue;
        const current = sectorByBlock.get(shift.block_id) ?? {
          openToAll: false,
          sectors: [],
          applicableShiftCount: 0,
          totalShiftCount: 0,
        };
        current.totalShiftCount += 1;
        const listed = listedShiftSectors(shift);
        if (!listed.length) {
          current.openToAll = true;
        } else {
          for (const sector of listed) {
            if (!current.sectors.some((item) => sectorsMatch(item, sector))) {
              current.sectors.push(sector);
            }
          }
        }
        if (
          shiftAppliesToSector(shift, volunteerSector)
          || markedShiftIds.has(shift.id)
        ) {
          current.applicableShiftCount += 1;
        }
        sectorByBlock.set(shift.block_id, current);
      }
    }

    const defaultBlockId =
      (allBlocks ?? []).find((block) => block.is_floor_default)?.id
      || null;

    // Every bulk stays selectable. Sector match + applicable shifts drive ranking / default.
    const relevantBlocks = (allBlocks ?? []).map((block) => {
      const info = sectorByBlock.get(block.id);
      const sectors = info?.sectors ?? [];
      const sectorMatch =
        Boolean(info?.openToAll)
        || (!volunteerSector && Boolean(info?.totalShiftCount))
        || sectors.some((sector) => sectorsMatch(sector, volunteerSector));
      const hasMarks = markBlockIds.has(block.id);
      const isDefault = block.id === defaultBlockId || Boolean(block.is_floor_default);
      const applicableShiftCount = info?.applicableShiftCount ?? 0;
      return {
        id: block.id,
        name: block.name,
        kind: block.kind,
        startDate: block.start_date,
        endDate: block.end_date,
        location: block.location || '',
        isFloorDefault: isDefault,
        hasMarks,
        sectorMatch: Boolean(sectorMatch),
        sectors: info?.openToAll ? [] : sectors,
        applicableShiftCount,
        totalShiftCount: info?.totalShiftCount ?? 0,
      };
    });

    relevantBlocks.sort((a, b) => {
      // Prefer bulks that actually have shifts for this volunteer's sector.
      const aFit = a.sectorMatch && a.applicableShiftCount > 0 ? 1 : 0;
      const bFit = b.sectorMatch && b.applicableShiftCount > 0 ? 1 : 0;
      if (aFit !== bFit) return bFit - aFit;
      if (a.sectorMatch !== b.sectorMatch) return a.sectorMatch ? -1 : 1;
      if (a.applicableShiftCount !== b.applicableShiftCount) {
        return b.applicableShiftCount - a.applicableShiftCount;
      }
      if (a.isFloorDefault !== b.isFloorDefault) return a.isFloorDefault ? -1 : 1;
      if (a.hasMarks !== b.hasMarks) return a.hasMarks ? -1 : 1;
      return String(b.startDate).localeCompare(String(a.startDate));
    });

    if (hasUngroupedMarks) {
      relevantBlocks.push({
        id: UNGROUPED,
        name: 'Ungrouped shifts',
        kind: '',
        startDate: '',
        endDate: '',
        location: '',
        isFloorDefault: false,
        hasMarks: true,
        sectorMatch: true,
        sectors: [],
        applicableShiftCount: 0,
        totalShiftCount: 0,
      });
    }

    // Prefer the bulk that lists this volunteer's sector (e.g. Health → Health training).
    const preferred =
      relevantBlocks.find(
        (block) => block.sectorMatch && block.applicableShiftCount > 0 && block.id !== UNGROUPED,
      )?.id
      || relevantBlocks.find((block) => block.sectorMatch && block.id !== UNGROUPED)?.id
      || (defaultBlockId && relevantBlocks.some((block) => block.id === defaultBlockId)
        ? defaultBlockId
        : null)
      || relevantBlocks.find((block) => block.hasMarks)?.id
      || relevantBlocks[0]?.id
      || '';

    const selectedBlockId =
      requestedBlockId && relevantBlocks.some((block) => block.id === requestedBlockId)
        ? requestedBlockId
        : preferred;

    let rows: ReturnType<typeof mapShiftRow>[] = [];

    if (selectedBlockId && selectedBlockId !== UNGROUPED) {
      // Sector-dynamic: only morning/afternoon slots that apply to this volunteer
      // (or where they already have a mark), so Health sees Health shifts, not Tourism.
      let shiftsQuery = supabase
        .from('ops_shifts')
        .select(`
          id,
          name,
          shift_date,
          start_time,
          end_time,
          kind,
          team_id,
          block_id,
          sheet_status,
          location,
          sector,
          sectors,
          ops_cohorts(name, code),
          ops_teams(name, code)
        `)
        .eq('block_id', selectedBlockId)
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (verifiedOnly) {
        shiftsQuery = shiftsQuery.eq('sheet_status', 'verified');
      }
      if (scopedTeamIds) {
        shiftsQuery = shiftsQuery.eq('kind', 'ops').in('team_id', scopedTeamIds);
      }

      const { data: shifts, error: shiftsError } = await shiftsQuery;
      if (shiftsError) return dbError(shiftsError);

      const applicableShifts = (shifts ?? []).filter((shift) => {
        if (markedShiftIds.has(shift.id)) return true;
        return shiftAppliesToSector(shift, volunteerSector);
      });

      const shiftIds = applicableShifts.map((shift) => shift.id);
      if (shiftIds.length) {
        const { data: blockMarks, error: blockMarksError } = await supabase
          .from('ops_attendance')
          .select('id, status, notes, checked_in_at, updated_at, shift_id')
          .eq('registration_id', id)
          .in('shift_id', shiftIds);
        if (blockMarksError) return dbError(blockMarksError);
        for (const mark of blockMarks ?? []) {
          marksByShiftId.set(mark.shift_id, mark);
        }
      }

      rows = sortAttendanceRows(
        applicableShifts.map((shift) => mapShiftRow(shift as ShiftRow, marksByShiftId.get(shift.id) || null)),
      );
    } else if (selectedBlockId === UNGROUPED) {
      let ungroupedQuery = supabase
        .from('ops_attendance')
        .select(`
          id,
          status,
          notes,
          checked_in_at,
          updated_at,
          shift_id,
          ops_shifts!inner(
            id,
            name,
            shift_date,
            start_time,
            end_time,
            kind,
            team_id,
            block_id,
            sheet_status,
            location,
            sector,
            sectors,
            ops_cohorts(name, code),
            ops_teams(name, code)
          )
        `)
        .eq('registration_id', id)
        .is('ops_shifts.block_id', null);

      if (verifiedOnly) {
        ungroupedQuery = ungroupedQuery.eq('ops_shifts.sheet_status', 'verified');
      }
      if (scopedTeamIds) {
        ungroupedQuery = ungroupedQuery.eq('ops_shifts.kind', 'ops').in('ops_shifts.team_id', scopedTeamIds);
      }

      const { data: ungrouped, error: ungroupedError } = await ungroupedQuery;
      if (ungroupedError) return dbError(ungroupedError);

      rows = sortAttendanceRows(
        (ungrouped ?? []).map((row) => {
          const shift = one(row.ops_shifts as ShiftRow | ShiftRow[] | null);
          if (!shift) {
            return mapShiftRow(
              {
                id: row.shift_id,
                name: '',
                shift_date: '',
                start_time: '',
                end_time: '',
                kind: '',
                team_id: null,
                block_id: null,
                sheet_status: '',
                location: '',
                ops_cohorts: null,
                ops_teams: null,
              },
              row,
            );
          }
          return mapShiftRow(shift, row);
        }),
      );
    }

    return NextResponse.json({
      rows,
      summary: summarize(rows),
      verifiedOnly,
      blocks: relevantBlocks,
      defaultBlockId,
      selectedBlockId,
      volunteer: volunteerPayload,
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
