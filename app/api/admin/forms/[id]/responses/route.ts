import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { dbError, requireFeature } from '@/app/lib/admin/guard';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireFeature(request, 'forms');
  if (!gate.ok) return gate.error;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {};
  const volunteerName = String(body.volunteerName ?? '').trim().slice(0, 160);
  if (!volunteerName) return NextResponse.json({ error: 'INVALID' }, { status: 400 });

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('ops_form_responses').insert({
      form_id: id,
      registration_id: body.registrationId ? String(body.registrationId) : null,
      volunteer_name: volunteerName,
      answers,
    });
    if (error) return dbError(error);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return dbError(error as { message?: string });
  }
}
