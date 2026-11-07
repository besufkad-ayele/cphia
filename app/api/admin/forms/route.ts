import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { dbError, requireCapability } from '@/app/lib/admin/guard';
import { cleanFields, isFormStatus } from '@/app/lib/admin/ops';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const gate = await requireCapability(request, 'forms.view');
  if (!gate.ok) return gate.error;
  try {
    const supabase = getSupabaseAdmin();
    const [forms, cohorts] = await Promise.all([
      supabase.from('ops_forms').select('id, title, description, status, fields, cohort_id, updated_at, ops_cohorts(name, code), ops_form_responses(count)').order('updated_at', { ascending: false }),
      supabase.from('ops_cohorts').select('id, name, code').order('name'),
    ]);
    if (forms.error) return dbError(forms.error);
    if (cohorts.error) return dbError(cohorts.error);
    return NextResponse.json({
      forms: (forms.data ?? []).map((form) => ({
        ...form,
        responses: Array.isArray(form.ops_form_responses) ? form.ops_form_responses[0]?.count ?? 0 : 0,
        fieldCount: Array.isArray(form.fields) ? form.fields.length : 0,
        ops_form_responses: undefined,
      })),
      cohorts: cohorts.data ?? [],
    });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireCapability(request, 'forms.create');
  if (!gate.ok) return gate.error;
  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? '').trim().slice(0, 140);
  if (!title) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  const status = String(body.status ?? 'draft');
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('ops_forms').insert({
      title,
      description: String(body.description ?? '').trim().slice(0, 1000),
      status: isFormStatus(status) ? status : 'draft',
      cohort_id: body.cohortId ? String(body.cohortId) : null,
      fields: cleanFields(body.fields),
      updated_at: new Date().toISOString(),
    }).select('id').single();
    if (error) return dbError(error);
    await logActivity({
      actor: gate.session,
      action: 'form.create',
      summary: `${gate.session.fullName} created form “${title}”`,
      entityType: 'form',
      entityId: data.id,
      metadata: { title, status },
      request,
    });
    return NextResponse.json({ id: data.id });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
