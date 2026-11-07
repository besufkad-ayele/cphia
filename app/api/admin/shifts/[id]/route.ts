import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireFeature } from '@/app/lib/admin/guard';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFeature(request, 'shifts');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const payload = {
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
  if (!payload.cohort_id || !payload.name || !payload.shift_date || !payload.start_time || !payload.end_time) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_shifts').update(payload).eq('id', id);
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'shift.update',
      summary: `${gate.session.fullName} updated shift “${payload.name}”`,
      entityType: 'shift',
      entityId: id,
      metadata: payload,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFeature(request, 'shifts');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_shifts').delete().eq('id', id);
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'shift.delete',
      summary: `${gate.session.fullName} deleted a shift`,
      entityType: 'shift',
      entityId: id,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
