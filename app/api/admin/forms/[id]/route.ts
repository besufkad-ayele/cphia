import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireFeature } from '@/app/lib/admin/guard';
import { cleanFields, isFormStatus } from '@/app/lib/admin/ops';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFeature(request, 'forms');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const [form, responses, cohorts] = await Promise.all([
      supabase.from('ops_forms').select('*').eq('id', id).maybeSingle(),
      supabase.from('ops_form_responses').select('id, volunteer_name, answers, created_at, registration_id').eq('form_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('ops_cohorts').select('id, name, code').order('name'),
    ]);
    if (form.error) return dbError(form.error);
    if (!form.data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    if (responses.error) return dbError(responses.error);
    if (cohorts.error) return dbError(cohorts.error);
    return NextResponse.json({ form: form.data, responses: responses.data ?? [], cohorts: cohorts.data ?? [] });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFeature(request, 'forms');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? '').trim().slice(0, 140);
  const status = String(body.status ?? 'draft');
  if (!title) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_forms').update({
      title,
      description: String(body.description ?? '').trim().slice(0, 1000),
      status: isFormStatus(status) ? status : 'draft',
      cohort_id: body.cohortId ? String(body.cohortId) : null,
      fields: cleanFields(body.fields),
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'form.update',
      summary: `${gate.session.fullName} updated form “${title}”`,
      entityType: 'form',
      entityId: id,
      metadata: { title, status },
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFeature(request, 'forms');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_forms').delete().eq('id', id);
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'form.delete',
      summary: `${gate.session.fullName} deleted a form`,
      entityType: 'form',
      entityId: id,
      request,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
