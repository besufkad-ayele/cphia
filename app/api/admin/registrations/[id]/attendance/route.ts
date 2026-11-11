import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { periodLabel, shiftPeriod } from '@/app/lib/admin/attendance-columns';
import { dbError } from '@/app/lib/admin/guard';
import { hasFeature } from '@/app/lib/admin/permissions';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

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

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, session);

    let query = supabase
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
          sheet_status,
          location,
          ops_cohorts(name, code),
          ops_teams(name, code)
        )
      `)
      .eq('registration_id', id)
      .order('updated_at', { ascending: false });

    if (verifiedOnly) {
      query = query.eq('ops_shifts.sheet_status', 'verified');
    }

    if (scopedTeamIds) {
      if (!scopedTeamIds.length) {
        return NextResponse.json({ rows: [], verifiedOnly });
      }
      query = query.eq('ops_shifts.kind', 'ops').in('ops_shifts.team_id', scopedTeamIds);
    }

    const { data, error } = await query;
    if (error) return dbError(error);

    const rows = (data ?? []).map((row) => {
      const shiftJoin = row.ops_shifts as
        | {
            id: string;
            name: string;
            shift_date: string;
            start_time: string;
            end_time: string;
            kind: string;
            team_id: string | null;
            sheet_status: string;
            location: string | null;
            ops_cohorts: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
            ops_teams: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
          }
        | {
            id: string;
            name: string;
            shift_date: string;
            start_time: string;
            end_time: string;
            kind: string;
            team_id: string | null;
            sheet_status: string;
            location: string | null;
            ops_cohorts: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
            ops_teams: { name?: string; code?: string } | { name?: string; code?: string }[] | null;
          }[]
        | null;
      const shift = Array.isArray(shiftJoin) ? shiftJoin[0] : shiftJoin;
      const cohortJoin = shift?.ops_cohorts;
      const teamJoin = shift?.ops_teams;
      const cohort = Array.isArray(cohortJoin) ? cohortJoin[0] : cohortJoin;
      const team = Array.isArray(teamJoin) ? teamJoin[0] : teamJoin;
      const period = shiftPeriod(shift?.start_time);
      return {
        id: row.id,
        status: row.status,
        notes: row.notes || '',
        checkedInAt: row.checked_in_at,
        updatedAt: row.updated_at,
        shiftId: shift?.id || row.shift_id,
        shiftName: shift?.name || '',
        shiftDate: shift?.shift_date || '',
        startTime: shift?.start_time ? String(shift.start_time).slice(0, 5) : '',
        endTime: shift?.end_time ? String(shift.end_time).slice(0, 5) : '',
        period,
        periodLabel: periodLabel(period),
        kind: shift?.kind || '',
        sheetStatus: shift?.sheet_status || '',
        location: shift?.location || '',
        teamName: team?.name || '',
        cohortCode: cohort?.code || '',
        cohortName: cohort?.name || '',
      };
    }).sort((a, b) => {
      // Chronological shift order: date, then morning before afternoon, then start time.
      const byDate = a.shiftDate.localeCompare(b.shiftDate);
      if (byDate) return byDate;
      const periodRank = (period: string) => (period === 'afternoon' ? 1 : 0);
      const byPeriod = periodRank(a.period) - periodRank(b.period);
      if (byPeriod) return byPeriod;
      return a.startTime.localeCompare(b.startTime) || a.shiftName.localeCompare(b.shiftName);
    });

    const summary = {
      total: rows.length,
      present: rows.filter((row) => row.status === 'present').length,
      late: rows.filter((row) => row.status === 'late').length,
      absent: rows.filter((row) => row.status === 'absent').length,
      excused: rows.filter((row) => row.status === 'excused').length,
    };

    return NextResponse.json({ rows, summary, verifiedOnly });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
