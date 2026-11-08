import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { periodLabel, shiftPeriod } from '@/app/lib/admin/attendance-columns';
import { loadAttendanceRows, summarizeAttendance } from '@/app/lib/admin/attendance-query';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { hasCapability } from '@/app/lib/admin/permissions';
import { assertSupervisorOwnsShift, supervisedTeamIds } from '@/app/lib/admin/team-scope';
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
  const gate = await requireCapability(request, 'attendance.view');
  if (!gate.ok) return gate.error;
  const { id } = await params;

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);

    const { data: shift, error: shiftError } = await supabase
      .from('ops_shifts')
      .select('id, name, shift_date, start_time, end_time, kind, team_id, sheet_status, location, capacity, block_id, ops_cohorts(name, code), ops_teams(name, code)')
      .eq('id', id)
      .maybeSingle();
    if (shiftError) return dbError(shiftError);
    if (!shift) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const ownership = await assertSupervisorOwnsShift(supabase, gate.session, shift);
    if (!ownership.ok) {
      return NextResponse.json({ error: 'FORBIDDEN', message: ownership.message }, { status: 403 });
    }

    const rows = await loadAttendanceRows(supabase, {
      shiftId: id,
      verifiedOnly: false,
      scopedTeamIds,
    });
    const summary = summarizeAttendance(rows);
    const cohort = one(shift.ops_cohorts as { name?: string; code?: string } | { name?: string; code?: string }[] | null);
    const team = one(shift.ops_teams as { name?: string; code?: string } | { name?: string; code?: string }[] | null);
    const period = shiftPeriod(shift.start_time);

    const volunteers = rows.map((row) => ({
      markId: row.id,
      status: row.status,
      notes: row.notes,
      checkedInAt: row.checked_in_at,
      registrationId: row.registration?.id || '',
      publicId: row.registration?.registration_id || '',
      name: [row.registration?.first_name, row.registration?.middle_name, row.registration?.last_name]
        .filter(Boolean)
        .join(' '),
      phone: row.registration?.phone || '',
      email: row.registration?.email || '',
      sector: row.registration?.sector || '',
    }));

    return NextResponse.json({
      canExport: hasCapability(gate.session, 'attendance.verify'),
      shift: {
        id: shift.id,
        name: shift.name,
        shiftDate: shift.shift_date,
        startTime: String(shift.start_time).slice(0, 5),
        endTime: String(shift.end_time).slice(0, 5),
        period: periodLabel(period),
        kind: shift.kind,
        sheetStatus: shift.sheet_status,
        location: shift.location || '',
        capacity: shift.capacity || 0,
        blockId: shift.block_id,
        cohortCode: cohort?.code || '',
        cohortName: cohort?.name || '',
        teamName: team?.name || '',
      },
      totals: summary.totals,
      averages: summary.averages,
      volunteers,
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
