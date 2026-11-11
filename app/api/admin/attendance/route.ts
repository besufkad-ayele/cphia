import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { seedAbsentRows } from '@/app/lib/admin/attendance-sheet';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { hasCapability, hasFeature } from '@/app/lib/admin/permissions';
import { isAttendanceStatus, sanitizeSearch } from '@/app/lib/admin/ops';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';
import { assertSupervisorOwnsShift, supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

type ShiftListRow = {
  id: string;
  name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  location: string;
  capacity: number;
  kind?: string;
  team_id?: string | null;
  sheet_status?: string;
  is_floor_default?: boolean;
  cohort_id?: string;
  ops_cohorts?: { name: string; code: string } | { name: string; code: string }[] | null;
  ops_teams?: { name: string; code: string } | { name: string; code: string }[] | null;
};

function volunteerDisplayName(person: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}) {
  return [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ').trim();
}

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();
  const canAttendance = hasCapability(session, 'attendance.view') || hasFeature(session, 'attendance');
  const canForms = hasFeature(session, 'forms');
  const canVolunteers = hasFeature(session, 'volunteers');
  const canTeams = hasFeature(session, 'teams');
  if (!canAttendance && !canForms && !canVolunteers && !canTeams) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const shiftId = request.nextUrl.searchParams.get('shiftId') || '';
  const search = sanitizeSearch(request.nextUrl.searchParams.get('q') || '');
  const mode = request.nextUrl.searchParams.get('mode');
  const statusFilter = request.nextUrl.searchParams.get('status') || '';

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, session);
    let shifts: ShiftListRow[] = [];
    if (canAttendance) {
      let shiftQuery = supabase
        .from('ops_shifts')
        .select('id, name, shift_date, start_time, end_time, location, capacity, kind, team_id, sheet_status, is_floor_default, cohort_id, ops_cohorts(name, code), ops_teams(name, code)')
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true });
      if (scopedTeamIds) {
        if (!scopedTeamIds.length) {
          shifts = [];
        } else {
          shiftQuery = shiftQuery.eq('kind', 'ops').in('team_id', scopedTeamIds);
          const shiftResult = await shiftQuery;
          if (shiftResult.error) return dbError(shiftResult.error);
          shifts = (shiftResult.data ?? []) as ShiftListRow[];
        }
      } else {
        const shiftResult = await shiftQuery;
        if (shiftResult.error) return dbError(shiftResult.error);
        shifts = (shiftResult.data ?? []) as ShiftListRow[];
      }
    }

    const defaultShiftId = shifts.find((shift) => shift.is_floor_default)?.id
      || shifts.find((shift) => (shift.sheet_status || 'open') === 'open')?.id
      || shifts[0]?.id
      || null;

    let rows: unknown[] = [];
    let lastPresentByPerson: Record<string, string> = {};
    let sheet: {
      seeded: number;
      sheetStatus: string;
      kind: string;
      teamName: string;
      counts: Record<string, number>;
    } | null = null;

    if (canAttendance && shiftId) {
      const { data: shift, error: shiftError } = await supabase
        .from('ops_shifts')
        .select('id, name, kind, team_id, cohort_id, sheet_status, ops_cohorts(code), ops_teams(name, code)')
        .eq('id', shiftId)
        .maybeSingle();
      if (shiftError) return dbError(shiftError);
      if (!shift) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

      const ownership = await assertSupervisorOwnsShift(supabase, session, shift);
      if (!ownership.ok) {
        return NextResponse.json({ error: 'FORBIDDEN', message: ownership.message }, { status: 403 });
      }

      let seeded = 0;
      if (shift.sheet_status !== 'verified') {
        const seed = await seedAbsentRows(supabase, shift, session.id);
        seeded = seed.seeded;
      }

      const attendance = await supabase
        .from('ops_attendance')
        .select('id, status, notes, checked_in_at, marked_by, registration_id, updated_at, registrations(id, registration_id, first_name, middle_name, last_name, sector, email, phone, review_status)')
        .eq('shift_id', shiftId)
        .order('updated_at', { ascending: false });
      if (attendance.error) return dbError(attendance.error);

      const approvedRows = (attendance.data ?? []).filter((row) => {
        const person = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
        return person?.review_status === 'approved';
      });

      const isSuperAdmin = session.role === 'super_admin';
      let markerNames = new Map<string, string>();
      if (isSuperAdmin) {
        const markerIds = [...new Set(
          approvedRows
            .map((row) => row.marked_by)
            .filter((id): id is string => Boolean(id)),
        )];
        const MARKER_CHUNK = 100;
        for (let i = 0; i < markerIds.length; i += MARKER_CHUNK) {
          const chunk = markerIds.slice(i, i + MARKER_CHUNK);
          const { data: markers, error: markerError } = await supabase
            .from('admins')
            .select('id, full_name, email')
            .in('id', chunk);
          if (markerError) return dbError(markerError);
          for (const marker of markers ?? []) {
            markerNames.set(marker.id, marker.full_name || marker.email || 'Admin');
          }
        }
      }

      const allRows = approvedRows.map((row) => {
        if (!isSuperAdmin) {
          const { marked_by: _markedBy, ...rest } = row;
          void _markedBy;
          return rest;
        }
        const markedByName = row.marked_by ? markerNames.get(row.marked_by) || null : null;
        return {
          ...row,
          marked_by_name: markedByName,
        };
      });

      const counts = { present: 0, late: 0, absent: 0, excused: 0, total: allRows.length };
      for (const row of allRows) {
        if (row.status in counts) counts[row.status as keyof typeof counts] += 1;
      }

      rows = statusFilter
        ? allRows.filter((row) => row.status === statusFilter)
        : allRows;

      const registrationIds = [...new Set(
        allRows.map((row) => row.registration_id).filter((id): id is string => Boolean(id)),
      )];
      // Chunk `.in(...)` — a full training sheet (~500–600 UUIDs) overflows PostgREST and returns "Bad Request".
      const PRIOR_CHUNK = 100;
      for (let i = 0; i < registrationIds.length; i += PRIOR_CHUNK) {
        const chunk = registrationIds.slice(i, i + PRIOR_CHUNK);
        const { data: priorMarks, error: priorError } = await supabase
          .from('ops_attendance')
          .select('registration_id, checked_in_at, status')
          .in('registration_id', chunk)
          .in('status', ['present', 'late'])
          .not('checked_in_at', 'is', null)
          .order('checked_in_at', { ascending: false })
          .limit(Math.min(chunk.length * 4, 800));
        if (priorError) return dbError(priorError);
        for (const mark of priorMarks ?? []) {
          if (!mark.registration_id || !mark.checked_in_at) continue;
          if (lastPresentByPerson[mark.registration_id]) continue;
          lastPresentByPerson[mark.registration_id] = mark.checked_in_at;
        }
      }

      const teamJoin = shift.ops_teams as { name?: string; code?: string } | { name?: string; code?: string }[] | null;
      const teamName = Array.isArray(teamJoin) ? teamJoin[0]?.name || '' : teamJoin?.name || '';
      sheet = {
        seeded,
        sheetStatus: shift.sheet_status || 'open',
        kind: shift.kind || 'training',
        teamName,
        counts,
      };
    }

    let matches: unknown[] = [];
    if (search || mode === 'approved') {
      let peopleQuery = supabase
        .from('registrations')
        .select('id, registration_id, first_name, middle_name, last_name, sector, email, phone')
        .eq('review_status', 'approved')
        .order('first_name', { ascending: true })
        .order('middle_name', { ascending: true })
        .order('last_name', { ascending: true });

      if (search) {
        const tokens = search.split(/\s+/).filter(Boolean);
        const clauses = [
          `first_name.ilike.%${search}%`,
          `middle_name.ilike.%${search}%`,
          `last_name.ilike.%${search}%`,
          `email.ilike.%${search}%`,
          `registration_id.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
          ...tokens.flatMap((token) => [
            `first_name.ilike.%${token}%`,
            `middle_name.ilike.%${token}%`,
            `last_name.ilike.%${token}%`,
            `registration_id.ilike.%${token}%`,
            `phone.ilike.%${token}%`,
            `email.ilike.%${token}%`,
          ]),
        ];
        peopleQuery = peopleQuery.or([...new Set(clauses)].join(',')).limit(40);
      } else {
        peopleQuery = peopleQuery.limit(5000);
      }

      const people = await peopleQuery;
      if (people.error) return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
      matches = people.data ?? [];
    }

    return NextResponse.json({
      shifts,
      rows,
      matches,
      sheet,
      defaultShiftId,
      lastPresentByPerson,
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireCapability(request, 'attendance.mark');
  if (!gate.ok) return gate.error;
  const body = await request.json().catch(() => ({}));
  const shiftId = String(body.shiftId ?? '');
  const registrationId = String(body.registrationId ?? '');
  const status = String(body.status ?? '');
  const notes = String(body.notes ?? '').trim().slice(0, 400);
  if (!shiftId || !registrationId || !isAttendanceStatus(status)) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: shift, error: shiftError } = await supabase
      .from('ops_shifts')
      .select('id, sheet_status, kind, team_id')
      .eq('id', shiftId)
      .maybeSingle();
    if (shiftError) return dbError(shiftError);
    if (!shift) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const ownership = await assertSupervisorOwnsShift(supabase, gate.session, shift);
    if (!ownership.ok) {
      return NextResponse.json({ error: 'FORBIDDEN', message: ownership.message }, { status: 403 });
    }

    if (shift.sheet_status === 'verified') {
      return NextResponse.json(
        { error: 'LOCKED', message: 'This sheet is verified. Reopen it before changing marks.' },
        { status: 400 },
      );
    }

    if (shift.sheet_status === 'submitted'
      && !hasCapability(gate.session, 'attendance.verify')
      && !hasCapability(gate.session, 'attendance.reopen')) {
      return NextResponse.json(
        { error: 'LOCKED', message: 'This sheet is submitted. Floor staff cannot change marks until an admin reopens it.' },
        { status: 400 },
      );
    }

    if (shift.kind === 'ops' && shift.team_id) {
      const { data: member, error: memberError } = await supabase
        .from('ops_team_members')
        .select('id')
        .eq('team_id', shift.team_id)
        .eq('registration_id', registrationId)
        .maybeSingle();
      if (memberError) return dbError(memberError);
      if (!member) {
        return NextResponse.json(
          { error: 'NOT_ON_TEAM', message: 'That volunteer is not on this floor team.' },
          { status: 400 },
        );
      }
    }

    const { data: volunteer, error: volunteerError } = await supabase
      .from('registrations')
      .select('id, first_name, middle_name, last_name, registration_id, review_status')
      .eq('id', registrationId)
      .maybeSingle();
    if (volunteerError) return dbError(volunteerError);
    if (!volunteer) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (volunteer.review_status !== 'approved') {
      return NextResponse.json({ error: 'NOT_APPROVED', message: 'Only approved volunteers can be marked on attendance.' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('ops_attendance')
      .select('status')
      .eq('shift_id', shiftId)
      .eq('registration_id', registrationId)
      .maybeSingle();

    const { error } = await supabase.from('ops_attendance').upsert(
      {
        shift_id: shiftId,
        registration_id: registrationId,
        status,
        notes,
        marked_by: gate.session.id,
        checked_in_at: status === 'present' || status === 'late' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shift_id,registration_id' },
    );
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'attendance.mark',
      summary: `${gate.session.fullName} marked attendance as ${status}`,
      entityType: 'attendance',
      entityId: registrationId,
      metadata: { shiftId, registrationId, status, notes },
      request,
    });
    return NextResponse.json({
      ok: true,
      status,
      previousStatus: existing?.status ?? null,
      person: {
        id: volunteer.id,
        registration_id: volunteer.registration_id,
        name: volunteerDisplayName(volunteer),
      },
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
