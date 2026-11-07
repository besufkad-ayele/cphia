import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { seedAbsentRows } from '@/app/lib/admin/attendance-sheet';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import type { PermissionKey } from '@/app/lib/admin/permissions';
import { assertSupervisorOwnsShift } from '@/app/lib/admin/team-scope';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

type Action = 'seed' | 'submit' | 'verify' | 'reopen';

const ACTION_CAPABILITY: Record<Action, PermissionKey> = {
  seed: 'attendance.mark',
  submit: 'attendance.submit',
  verify: 'attendance.verify',
  reopen: 'attendance.reopen',
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? '') as Action;
  if (!['seed', 'submit', 'verify', 'reopen'].includes(action)) {
    return NextResponse.json({ error: 'INVALID', message: 'Unknown sheet action.' }, { status: 400 });
  }
  const gate = await requireCapability(request, ACTION_CAPABILITY[action]);
  if (!gate.ok) return gate.error;

  try {
    const supabase = getSupabaseAdmin();
    const { data: shift, error } = await supabase
      .from('ops_shifts')
      .select('id, name, kind, team_id, cohort_id, sheet_status, ops_cohorts(code)')
      .eq('id', id)
      .maybeSingle();
    if (error) return dbError(error);
    if (!shift) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

    const ownership = await assertSupervisorOwnsShift(supabase, gate.session, shift);
    if (!ownership.ok) {
      return NextResponse.json({ error: 'FORBIDDEN', message: ownership.message }, { status: 403 });
    }

    if (action === 'seed') {
      const result = await seedAbsentRows(supabase, shift, gate.session.id);
      await logActivity({
        actor: gate.session,
        action: 'attendance.seed',
        summary: `${gate.session.fullName} seeded absent rows on “${shift.name}”`,
        entityType: 'shift',
        entityId: id,
        metadata: result,
        request,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (action === 'submit') {
      if (shift.sheet_status === 'verified') {
        return NextResponse.json({ error: 'LOCKED', message: 'Verified sheets cannot be submitted again.' }, { status: 400 });
      }
      await seedAbsentRows(supabase, shift, gate.session.id);
      const { error: updateError } = await supabase
        .from('ops_shifts')
        .update({
          sheet_status: 'submitted',
          submitted_by: gate.session.id,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (updateError) return dbError(updateError);
      await logActivity({
        actor: gate.session,
        action: 'attendance.submit',
        summary: `${gate.session.fullName} submitted attendance for “${shift.name}”`,
        entityType: 'shift',
        entityId: id,
        request,
      });
      return NextResponse.json({ ok: true, sheetStatus: 'submitted' });
    }

    if (action === 'verify') {
      await seedAbsentRows(supabase, shift, gate.session.id);
      const verifyPatch: Record<string, unknown> = {
        sheet_status: 'verified',
        verified_by: gate.session.id,
        verified_at: new Date().toISOString(),
      };
      if (shift.sheet_status === 'open') {
        verifyPatch.submitted_by = gate.session.id;
        verifyPatch.submitted_at = new Date().toISOString();
      }
      const { error: updateError } = await supabase.from('ops_shifts').update(verifyPatch).eq('id', id);
      if (updateError) return dbError(updateError);
      await logActivity({
        actor: gate.session,
        action: 'attendance.verify',
        summary: `${gate.session.fullName} verified attendance for “${shift.name}”`,
        entityType: 'shift',
        entityId: id,
        request,
      });
      return NextResponse.json({ ok: true, sheetStatus: 'verified' });
    }

    // reopen
    const { error: reopenError } = await supabase
      .from('ops_shifts')
      .update({
        sheet_status: 'open',
        verified_by: null,
        verified_at: null,
      })
      .eq('id', id);
    if (reopenError) return dbError(reopenError);
    await logActivity({
      actor: gate.session,
      action: 'attendance.reopen',
      summary: `${gate.session.fullName} reopened attendance for “${shift.name}”`,
      entityType: 'shift',
      entityId: id,
      request,
    });
    return NextResponse.json({ ok: true, sheetStatus: 'open' });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
