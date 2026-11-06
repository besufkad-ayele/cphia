import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbError, requireFeature } from '@/app/lib/admin/guard';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function shiftPayload(body: Record<string, unknown>) {
  return {
    cohort_id: String(body.cohortId ?? ''),
    name: String(body.name ?? '').trim().slice(0, 120),
    shift_date: String(body.date ?? ''),
    start_time: String(body.startTime ?? ''),
    end_time: String(body.endTime ?? ''),
    location: String(body.location ?? '').trim().slice(0, 160),
    sector: String(body.sector ?? '').trim().slice(0, 80),
    capacity: Math.max(0, Number(body.capacity) || 0),
    notes: String(body.notes ?? '').trim().slice(0, 1000),
  };
}

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'shifts');
  if (!gate.ok) return gate.error;
  try {
    const supabase = getSupabaseAdmin();
    const [shifts, cohorts] = await Promise.all([
      supabase.from('ops_shifts').select('id, cohort_id, name, shift_date, start_time, end_time, location, sector, capacity, notes, ops_cohorts(name, code), ops_attendance(count)').order('shift_date', { ascending: true }).order('start_time', { ascending: true }),
      supabase.from('ops_cohorts').select('id, name, code').order('name'),
    ]);
    if (shifts.error) return dbError(shifts.error);
    if (cohorts.error) return dbError(cohorts.error);
    return NextResponse.json({
      shifts: (shifts.data ?? []).map((shift) => ({
        ...shift,
        marked: Array.isArray(shift.ops_attendance) ? shift.ops_attendance[0]?.count ?? 0 : 0,
        ops_attendance: undefined,
      })),
      cohorts: cohorts.data ?? [],
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireFeature(request, 'shifts');
  if (!gate.ok) return gate.error;
  const payload = shiftPayload(await request.json().catch(() => ({})));
  if (!payload.cohort_id || !payload.name || !payload.shift_date || !payload.start_time || !payload.end_time) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('ops_shifts').insert(payload).select('id').single();
    if (error) return dbError(error);
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
