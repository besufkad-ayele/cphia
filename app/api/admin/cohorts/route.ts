import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbError, requireFeature } from '@/app/lib/admin/guard';
import { isCohortStatus } from '@/app/lib/admin/ops';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function cohortPayload(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim().slice(0, 120);
  const code = String(body.code ?? '').trim().slice(0, 40);
  const status = String(body.status ?? 'planning');
  const capacity = Math.max(0, Number(body.capacity) || 0);
  return {
    name,
    code,
    venue: String(body.venue ?? '').trim().slice(0, 160),
    starts_on: body.startsOn ? String(body.startsOn) : null,
    ends_on: body.endsOn ? String(body.endsOn) : null,
    description: String(body.description ?? '').trim().slice(0, 2000),
    status: isCohortStatus(status) ? status : 'planning',
    capacity,
  };
}

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'cohorts');
  if (!gate.ok) return gate.error;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('ops_cohorts')
      .select('id, name, code, venue, starts_on, ends_on, description, status, capacity, created_at, ops_shifts(count)')
      .order('created_at', { ascending: false });
    if (error) return dbError(error);
    const rows = await Promise.all((data ?? []).map(async (row) => {
      const { count } = await supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('cohort', row.code);
      const shiftCount = Array.isArray(row.ops_shifts) ? row.ops_shifts[0]?.count ?? 0 : 0;
      return { ...row, volunteers: count ?? 0, shifts: shiftCount, ops_shifts: undefined };
    }));
    return NextResponse.json({ cohorts: rows });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireFeature(request, 'cohorts');
  if (!gate.ok) return gate.error;
  const payload = cohortPayload(await request.json().catch(() => ({})));
  if (!payload.name || !payload.code) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('ops_cohorts').insert(payload).select('id').single();
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'DUPLICATE', message: 'That cohort code is already in use.' }, { status: 400 });
      return dbError(error);
    }
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
