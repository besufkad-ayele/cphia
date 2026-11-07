import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireFeature } from '@/app/lib/admin/guard';
import { hasFeature } from '@/app/lib/admin/permissions';
import { isAttendanceStatus, sanitizeSearch } from '@/app/lib/admin/ops';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();
  const canAttendance = hasFeature(session, 'attendance');
  const canForms = hasFeature(session, 'forms');
  const canVolunteers = hasFeature(session, 'volunteers');
  if (!canAttendance && !canForms && !canVolunteers) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const shiftId = request.nextUrl.searchParams.get('shiftId') || '';
  const search = sanitizeSearch(request.nextUrl.searchParams.get('q') || '');
  const mode = request.nextUrl.searchParams.get('mode');
  try {
    const supabase = getSupabaseAdmin();
    let shifts: unknown[] = [];
    if (canAttendance) {
      const shiftResult = await supabase
        .from('ops_shifts')
        .select('id, name, shift_date, start_time, end_time, location, capacity, ops_cohorts(name, code)')
        .order('shift_date', { ascending: true })
        .order('start_time', { ascending: true });
      if (shiftResult.error) return dbError(shiftResult.error);
      shifts = shiftResult.data ?? [];
    }

    let rows: unknown[] = [];
    if (canAttendance && shiftId) {
      const attendance = await supabase
        .from('ops_attendance')
        .select('id, status, notes, checked_in_at, registration_id, registrations(id, registration_id, first_name, middle_name, last_name, sector, email, review_status)')
        .eq('shift_id', shiftId)
        .order('updated_at', { ascending: false });
      if (attendance.error) return dbError(attendance.error);
      rows = (attendance.data ?? []).filter((row) => {
        const person = Array.isArray(row.registrations) ? row.registrations[0] : row.registrations;
        return person?.review_status === 'approved';
      });
    }

    let matches: unknown[] = [];
    if (search || mode === 'approved') {
      let peopleQuery = supabase
        .from('registrations')
        .select('id, registration_id, first_name, middle_name, last_name, sector, email')
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
          ...tokens.flatMap((token) => [
            `first_name.ilike.%${token}%`,
            `middle_name.ilike.%${token}%`,
            `last_name.ilike.%${token}%`,
          ]),
        ];
        peopleQuery = peopleQuery.or([...new Set(clauses)].join(',')).limit(12);
      } else {
        peopleQuery = peopleQuery.limit(500);
      }

      const people = await peopleQuery;
      if (people.error) return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
      matches = people.data ?? [];
    }

    return NextResponse.json({ shifts, rows, matches });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireFeature(request, 'attendance');
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
    const { data: volunteer, error: volunteerError } = await supabase
      .from('registrations')
      .select('id, review_status')
      .eq('id', registrationId)
      .maybeSingle();
    if (volunteerError) return dbError(volunteerError);
    if (!volunteer) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (volunteer.review_status !== 'approved') {
      return NextResponse.json({ error: 'NOT_APPROVED', message: 'Only approved volunteers can be marked on attendance.' }, { status: 400 });
    }

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
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
