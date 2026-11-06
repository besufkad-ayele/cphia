import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbError, isMissingTable, requireFeature } from '@/app/lib/admin/guard';
import { hasFeature } from '@/app/lib/admin/permissions';
import { deriveAdminStatus } from '@/app/lib/admin/status';
import type { RegistrationSummary } from '@/app/lib/admin/types';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

async function countRegistrations(status?: string) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from('registrations').select('id', { count: 'exact', head: true });
  if (status) query = query.eq('review_status', status);
  const { count } = await query;
  return count ?? 0;
}

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'dashboard');
  if (!gate.ok) return gate.error;

  const today = request.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const session = gate.session;

  try {
    const supabase = getSupabaseAdmin();
    const [total, pending, approved, review, flagged] = await Promise.all([
      countRegistrations(),
      countRegistrations('pending'),
      countRegistrations('approved'),
      countRegistrations('review'),
      countRegistrations('flagged'),
    ]);

    let recent: RegistrationSummary[] = [];
    if (hasFeature(session, 'volunteers')) {
      const { data } = await supabase
        .from('registrations')
        .select('id, registration_id, first_name, last_name, email, sector, residence_region, email_status, device_flag, review_status, created_at, ui_language, phone, secondary_phone, fan_number, bank_name, cohort')
        .order('created_at', { ascending: false })
        .limit(6);
      recent = (data ?? []).map((row) => ({
        id: row.id,
        registrationId: row.registration_id,
        name: `${row.first_name} ${row.last_name}`.trim(),
        email: row.email,
        phone: row.phone ?? '',
        secondaryPhone: row.secondary_phone ?? '',
        fanNumber: row.fan_number ?? '',
        sector: row.sector,
        residenceRegion: row.residence_region,
        status: deriveAdminStatus(row.review_status, row.email_status, row.device_flag),
        createdAt: row.created_at,
        uiLanguage: row.ui_language ?? 'en',
        deviceFlag: row.device_flag,
        bankName: row.bank_name ?? '',
        cohort: row.cohort ?? 'CPHIA-26',
      }));
    }

    let migrationRequired = false;
    let cohorts = 0;
    let shiftsToday = 0;
    let checkedInToday = 0;
    let formsPublished = 0;
    let team = 0;
    let todayBoard: Array<{ id: string; name: string; location: string; start: string; end: string; capacity: number; present: number; cohort: string }> = [];

    const shiftResult = await supabase
      .from('ops_shifts')
      .select('id, name, location, start_time, end_time, capacity, ops_cohorts(code), ops_attendance(status)')
      .eq('shift_date', today)
      .order('start_time', { ascending: true })
      .limit(6);

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
      shiftsToday = shiftResult.data?.length ?? 0;
      todayBoard = ((shiftResult.data ?? []) as Array<{
        id: string;
        name: string;
        location: string | null;
        start_time: string;
        end_time: string;
        capacity: number;
        ops_attendance: { status?: string }[] | null;
        ops_cohorts: { code?: string } | { code?: string }[] | null;
      }>).map((shift) => {
        const marks = Array.isArray(shift.ops_attendance) ? shift.ops_attendance : [];
        const present = marks.filter((mark) => mark.status === 'present' || mark.status === 'late').length;
        const cohortJoin = shift.ops_cohorts;
        const cohort = Array.isArray(cohortJoin) ? cohortJoin[0]?.code : cohortJoin?.code;
        checkedInToday += present;
        return {
          id: shift.id,
          name: shift.name,
          location: shift.location || 'Location not set',
          start: String(shift.start_time).slice(0, 5),
          end: String(shift.end_time).slice(0, 5),
          capacity: shift.capacity,
          present,
          cohort: cohort || 'Cohort',
        };
      });
    }

    return NextResponse.json({
      metrics: { total, pending, approved, review, flagged },
      recent,
      cohorts,
      shiftsToday,
      checkedInToday,
      formsPublished,
      team,
      todayBoard,
      migrationRequired,
      permissions: session.permissions,
      role: session.role,
    });
  } catch (error) {
    console.error('admin_overview_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
}
