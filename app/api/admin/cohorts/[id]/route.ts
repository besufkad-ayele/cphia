import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { isCohortStatus } from '@/app/lib/admin/ops';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'cohorts.view');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('ops_cohorts').select('*').eq('id', id).maybeSingle();
    if (error) return dbError(error);
    if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    const [{ count }, shifts] = await Promise.all([
      supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('cohort', data.code),
      supabase.from('ops_shifts').select('id, name, shift_date, start_time, end_time, location, sector, capacity, notes').eq('cohort_id', id).order('shift_date', { ascending: true }).order('start_time', { ascending: true }),
    ]);
    if (shifts.error) return dbError(shifts.error);
    return NextResponse.json({ cohort: data, volunteers: count ?? 0, shifts: shifts.data ?? [] });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireCapability(request, 'cohorts.edit');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = String(body.status ?? 'planning');
  const payload = {
    name: String(body.name ?? '').trim().slice(0, 120),
    code: String(body.code ?? '').trim().slice(0, 40),
    venue: String(body.venue ?? '').trim().slice(0, 160),
    starts_on: body.startsOn ? String(body.startsOn) : null,
    ends_on: body.endsOn ? String(body.endsOn) : null,
    description: String(body.description ?? '').trim().slice(0, 2000),
    status: isCohortStatus(status) ? status : 'planning',
    capacity: Math.max(0, Number(body.capacity) || 0),
  };
  if (!payload.name || !payload.code) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_cohorts').update(payload).eq('id', id);
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'DUPLICATE', message: 'That cohort code is already in use.' }, { status: 400 });
      return dbError(error);
    }
    await logActivity({
      actor: gate.session,
      action: 'cohort.update',
      summary: `${gate.session.fullName} updated cohort “${payload.name}”`,
      entityType: 'cohort',
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
  const gate = await requireCapability(request, 'cohorts.delete');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_cohorts').delete().eq('id', id);
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'cohort.delete',
      summary: `${gate.session.fullName} deleted a cohort`,
      entityType: 'cohort',
      entityId: id,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
