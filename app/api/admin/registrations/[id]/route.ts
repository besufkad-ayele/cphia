import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireFeature } from '@/app/lib/admin/guard';
import { deriveAdminStatus, isAdminStatus } from '@/app/lib/admin/status';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const UPDATABLE = [
  'first_name',
  'middle_name',
  'last_name',
  'full_name_amharic',
  'sex',
  'age',
  'nationality',
  'fan_number',
  'phone',
  'secondary_phone',
  'email',
  'residence_region',
  'residence_detail',
  'profession',
  'education_level',
  'emergency_name',
  'emergency_phone',
  'emergency_relationship',
  'sector',
  'bank_name',
  'bank_account_name',
  'bank_account_number',
  'review_status',
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('registrations')
    .select('*, registration_languages(language_group, language, proficiency)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('admin_registration_detail_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  async function signed(path: string | null) {
    if (!path) return null;
    const { data: signedUrl } = await supabase.storage.from('volunteer-photos').createSignedUrl(path, 60 * 30);
    return signedUrl?.signedUrl ?? null;
  }

  return NextResponse.json({
    ...data,
    status: deriveAdminStatus(data.review_status, data.email_status, data.device_flag),
    photoUrl: await signed(data.photo_path),
    ureportUrl: await signed(data.ureport_screenshot_path),
    fanPhotoUrl: await signed(data.fan_photo_path),
    secondIdPhotoUrl: await signed(data.second_id_photo_path),
    bankOwnerIdPhotoUrl: await signed(data.bank_owner_id_photo_path),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  const action = typeof body?.action === 'string' ? body.action : '';
  if (action === 'approve' || action === 'approved') updates.review_status = 'approved';
  else if (action === 'review') updates.review_status = 'review';
  else if (action === 'flag' || action === 'flagged') updates.review_status = 'flagged';
  else if (action === 'pending') updates.review_status = 'pending';
  else if (isAdminStatus(action)) updates.review_status = action;

  for (const key of UPDATABLE) {
    if (body?.[key] !== undefined) updates[key] = body[key];
  }

  if (body?.review_status && isAdminStatus(body.review_status)) {
    updates.review_status = body.review_status;
  }

  if (updates.age !== undefined) {
    const age = Number(updates.age);
    if (!Number.isInteger(age)) {
      return NextResponse.json({ error: 'INVALID_AGE' }, { status: 400 });
    }
    updates.age = age;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'NO_UPDATES' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('registrations')
    .update(updates)
    .eq('id', id)
    .select('id, review_status, email_status, device_flag')
    .maybeSingle();

  if (error || !data) {
    console.error('admin_registration_patch_error', error);
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    status: deriveAdminStatus(data.review_status, data.email_status, data.device_flag),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('registrations').delete().eq('id', id);
  if (error) {
    console.error('admin_registration_delete_error', error);
    return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
