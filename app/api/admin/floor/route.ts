import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { hasCapability } from '@/app/lib/admin/permissions';
import type { AdminSession } from '@/app/lib/admin/session';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
type AttendanceMark = { status?: string | null; registration_id?: string | null };

const STATUS_RANK: Record<AttendanceStatus, number> = {
  present: 4,
  late: 3,
  excused: 2,
  absent: 1,
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function asStatus(value: string | null | undefined): AttendanceStatus | null {
  if (value === 'present' || value === 'late' || value === 'absent' || value === 'excused') return value;
  return null;
}

/** Best status across a person's marks for the day (present beats late beats excused beats absent). */
function rollupUniquePeople(marks: AttendanceMark[]) {
  const byPerson = new Map<string, AttendanceStatus>();
  for (const mark of marks) {
    const personId = mark.registration_id;
    const status = asStatus(mark.status);
    if (!personId || !status) continue;
    const current = byPerson.get(personId);
    if (!current || STATUS_RANK[status] > STATUS_RANK[current]) {
      byPerson.set(personId, status);
    }
  }

  const totals = { present: 0, late: 0, absent: 0, excused: 0, people: byPerson.size };
  for (const status of byPerson.values()) {
    totals[status] += 1;
  }
  return totals;
}

export async function GET(request: NextRequest) {
  let session: AdminSession;
  const gate = await requireCapability(request, 'floor.view');
  if (gate.ok) {
    session = gate.session;
  } else {
    const attendanceGate = await requireCapability(request, 'attendance.view');
    if (!attendanceGate.ok) return gate.error;
    session = attendanceGate.session;
  }
  const showTeamRollups = hasCapability(session, 'floor.teams') || hasCapability(session, 'floor.view');

  const date = request.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const cohortId = request.nextUrl.searchParams.get('cohortId') || '';

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, session);
    let shiftsQuery = supabase
      .from('ops_shifts')
      .select('id, name, shift_date, start_time, end_time, location, capacity, kind, team_id, sheet_status, cohort_id, ops_cohorts(name, code), ops_teams(id, name, code), ops_attendance(status, registration_id)')
      .eq('shift_date', date)
      .order('start_time', { ascending: true });
    if (cohortId) shiftsQuery = shiftsQuery.eq('cohort_id', cohortId);
    if (scopedTeamIds) {
      if (!scopedTeamIds.length) {
        return NextResponse.json({
          date,
          totals: { present: 0, late: 0, absent: 0, excused: 0, gap: 0, shifts: 0, people: 0 },
          shifts: [],
          teams: [],
          cohorts: [],
          allTeams: [],
          scoped: true,
        });
      }
      shiftsQuery = shiftsQuery.eq('kind', 'ops').in('team_id', scopedTeamIds);
    }

    const [shiftsResult, cohorts, teams] = await Promise.all([
      shiftsQuery,
      supabase.from('ops_cohorts').select('id, name, code').order('name'),
      supabase.from('ops_teams').select('id, name, code, cohort_id, status').eq('status', 'active').order('name'),
    ]);
    if (shiftsResult.error) return dbError(shiftsResult.error);

    const allMarks: AttendanceMark[] = [];
    const marksByTeam = new Map<string, { teamId: string; teamName: string; marks: AttendanceMark[]; gap: number; shifts: number }>();

    const shifts = (shiftsResult.data ?? []).map((shift) => {
      const marks = (Array.isArray(shift.ops_attendance) ? shift.ops_attendance : []) as AttendanceMark[];
      allMarks.push(...marks);
      const present = marks.filter((mark) => mark.status === 'present').length;
      const late = marks.filter((mark) => mark.status === 'late').length;
      const absent = marks.filter((mark) => mark.status === 'absent').length;
      const excused = marks.filter((mark) => mark.status === 'excused').length;
      const checkedIn = present + late;
      const capacity = shift.capacity || 0;
      const gap = capacity > 0 ? Math.max(0, capacity - checkedIn) : 0;
      const cohort = one(shift.ops_cohorts);
      const team = one(shift.ops_teams);
      if (team) {
        const current = marksByTeam.get(team.id) || {
          teamId: team.id,
          teamName: team.name,
          marks: [] as AttendanceMark[],
          gap: 0,
          shifts: 0,
        };
        current.marks.push(...marks);
        current.gap += gap;
        current.shifts += 1;
        marksByTeam.set(team.id, current);
      }
      return {
        id: shift.id,
        name: shift.name,
        start: String(shift.start_time).slice(0, 5),
        end: String(shift.end_time).slice(0, 5),
        location: shift.location || '',
        kind: shift.kind || 'training',
        sheetStatus: shift.sheet_status || 'open',
        capacity,
        present,
        late,
        absent,
        excused,
        checkedIn,
        totalMarked: marks.length,
        gap,
        cohort: cohort ? { id: shift.cohort_id, name: cohort.name, code: cohort.code } : null,
        team: team ? { id: team.id, name: team.name, code: team.code } : null,
      };
    });

    const dayPeople = rollupUniquePeople(allMarks);
    const totals = {
      present: dayPeople.present,
      late: dayPeople.late,
      absent: dayPeople.absent,
      excused: dayPeople.excused,
      people: dayPeople.people,
      gap: shifts.reduce((sum, shift) => sum + shift.gap, 0),
      shifts: shifts.length,
    };

    const byTeam = [...marksByTeam.values()].map((team) => {
      const people = rollupUniquePeople(team.marks);
      return {
        teamId: team.teamId,
        teamName: team.teamName,
        present: people.present,
        late: people.late,
        absent: people.absent,
        excused: people.excused,
        gap: team.gap,
        shifts: team.shifts,
      };
    });

    return NextResponse.json({
      date,
      totals,
      shifts,
      teams: showTeamRollups
        ? byTeam.sort((a, b) => a.teamName.localeCompare(b.teamName))
        : [],
      cohorts: cohorts.data ?? [],
      allTeams: teams.data ?? [],
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
