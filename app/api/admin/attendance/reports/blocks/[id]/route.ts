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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireCapability(request, 'attendance.view');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const verifiedOnly = request.nextUrl.searchParams.get('verifiedOnly') === '1';

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);

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

    const rows = await loadAttendanceRows(supabase, {
      blockId: id,
      verifiedOnly,
      scopedTeamIds,
    });
    const summary = summarizeAttendance(rows);
    const cohort = one(block.ops_cohorts as { name?: string; code?: string } | { name?: string; code?: string }[] | null);
    const team = one(block.ops_teams as { name?: string; code?: string } | { name?: string; code?: string }[] | null);

    return NextResponse.json({
      canExport: hasCapability(gate.session, 'attendance.verify'),
      verifiedOnly,
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
      totals: summary.totals,
      averages: summary.averages,
      byDay: summary.byDay,
      byShift: summary.byShift,
      byPerson: summary.byPerson,
      markCount: rows.length,
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
