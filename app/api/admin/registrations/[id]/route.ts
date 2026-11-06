import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';
import { deriveAdminStatus } from '@/app/lib/admin/status';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

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

  if (!data) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  let photoUrl: string | null = null;
  if (data.photo_path) {
    const { data: signed } = await supabase.storage
      .from('volunteer-photos')
      .createSignedUrl(data.photo_path, 60 * 30);
    photoUrl = signed?.signedUrl ?? null;
  }

  return NextResponse.json({
    ...data,
    status: deriveAdminStatus(data.email_status, data.device_flag),
    photoUrl,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = body?.action === 'flag' ? 'failed' : 'sent';

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('registrations')
    .update({ email_status: action })
    .eq('id', id)
    .select('id, email_status, device_flag')
    .maybeSingle();

  if (error || !data) {
    console.error('admin_registration_patch_error', error);
    return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    status: deriveAdminStatus(data.email_status, data.device_flag),
  });
}
