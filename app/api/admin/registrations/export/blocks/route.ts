import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbError, requireFeature } from '@/app/lib/admin/guard';
import { supervisedTeamIds } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

/** Lightweight bulk-sheet list for the volunteers export attendance checklist. */
export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  try {
    const supabase = getSupabaseAdmin();
    const scopedTeamIds = await supervisedTeamIds(supabase, gate.session);

    let blocksQuery = supabase
      .from('ops_shift_blocks')
      .select('id, name, kind, start_date, end_date, location, is_floor_default, team_id')
      .order('start_date', { ascending: false });

    if (scopedTeamIds) {
      if (!scopedTeamIds.length) {
        return NextResponse.json({ blocks: [] });
      }
      blocksQuery = blocksQuery.eq('kind', 'ops').in('team_id', scopedTeamIds);
    }

    const { data: blocks, error } = await blocksQuery;
    if (error) return dbError(error);

    const blockIds = (blocks ?? []).map((block) => block.id);
    const shiftCountByBlock = new Map<string, number>();
    if (blockIds.length) {
      const { data: shifts, error: shiftsError } = await supabase
        .from('ops_shifts')
        .select('id, block_id')
        .in('block_id', blockIds);
      if (shiftsError) return dbError(shiftsError);
      for (const shift of shifts ?? []) {
        if (!shift.block_id) continue;
        shiftCountByBlock.set(shift.block_id, (shiftCountByBlock.get(shift.block_id) || 0) + 1);
      }
    }

    return NextResponse.json({
      blocks: (blocks ?? []).map((block) => ({
        id: block.id,
        name: block.name,
        kind: block.kind,
        startDate: block.start_date,
        endDate: block.end_date,
        location: block.location || '',
        isFloorDefault: Boolean(block.is_floor_default),
        shiftCount: shiftCountByBlock.get(block.id) || 0,
      })),
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
