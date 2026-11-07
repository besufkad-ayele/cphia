import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logActivity } from '@/app/lib/admin/activity';
import { requireFeature } from '@/app/lib/admin/guard';
import { deriveAdminStatus, isAdminStatus } from '@/app/lib/admin/status';
import { extensionForMime, uploadVolunteerPhoto } from '@/app/lib/storage/volunteer-photos';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const UPDATABLE = [
  'registration_id',
  'cohort',
  'first_name',
  'middle_name',
  'last_name',
  'full_name_amharic',
  'sex',
  'age',
  'nationality',
  'fan_number',
  'second_id_type',
  'second_id_number',
  'phone',
  'secondary_phone',
  'whatsapp_number',
  'phone_is_whatsapp',
  'no_whatsapp',
  'email',
  'residence_region',
  'residence_detail',
  'profession',
  'education_level',
  'emergency_name',
  'emergency_phone',
  'emergency_relationship',
  'sector',
  'health_subsectors',
  'bank_name',
  'bank_account_name',
  'bank_account_number',
  'bank_account_other_owner',
  'ureport_registered',
  'review_status',
  'review_note',
  'ui_language',
] as const;

const PHOTO_FIELDS = [
  { formKey: 'photo', column: 'photo_path', suffix: '', imagesOnly: false },
  { formKey: 'fanPhoto', column: 'fan_photo_path', suffix: '-fan', imagesOnly: false },
  { formKey: 'fanPhotoBack', column: 'fan_photo_back_path', suffix: '-fan-back', imagesOnly: false },
  { formKey: 'secondIdPhoto', column: 'second_id_photo_path', suffix: '-second-id', imagesOnly: false },
  { formKey: 'bankOwnerIdPhoto', column: 'bank_owner_id_photo_path', suffix: '-bank-owner', imagesOnly: false },
  { formKey: 'ureportScreenshot', column: 'ureport_screenshot_path', suffix: '-ureport', imagesOnly: false },
] as const;

const BOOLEAN_FIELDS = new Set([
  'phone_is_whatsapp',
  'no_whatsapp',
  'bank_account_other_owner',
  'ureport_registered',
]);

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true' || value === '1' || value === 'Yes') return true;
    if (value === 'false' || value === '0' || value === 'No') return false;
  }
  return null;
}

function parseLanguages(raw: unknown) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const language = String(row.language ?? '').trim();
        if (!language) return null;
        return {
          language_group: String(row.language_group ?? row.group ?? 'other'),
          language,
          proficiency: String(row.proficiency ?? 'Basic'),
        };
      })
      .filter(Boolean) as Array<{ language_group: string; language: string; proficiency: string }>;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return parseLanguages(JSON.parse(trimmed));
    } catch {
      return trimmed
        .split(/\n|,/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const match = part.match(/^(.+?)\s*\((.+)\)\s*$/);
          if (match) {
            return { language_group: 'other', language: match[1].trim(), proficiency: match[2].trim() };
          }
          return { language_group: 'other', language: part, proficiency: 'Basic' };
        });
    }
  }
  return null;
}

async function parseBody(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const body: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') body[key] = value;
      else body[key] = value;
    }
    return { body, form };
  }
  const body = await request.json().catch(() => ({}));
  return { body: body as Record<string, unknown>, form: null as FormData | null };
}

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

  const cohortCode = data.cohort || 'CPHIA-26';
  const cohortResult = await supabase
    .from('ops_cohorts')
    .select('id, name, code, venue, starts_on, ends_on, description, status, capacity')
    .eq('code', cohortCode)
    .maybeSingle();
  const cohortRow = cohortResult.error ? null : cohortResult.data;

  return NextResponse.json({
    ...data,
    status: deriveAdminStatus(data.review_status, data.email_status, data.device_flag),
    photoUrl: await signed(data.photo_path),
    ureportUrl: await signed(data.ureport_screenshot_path),
    fanPhotoUrl: await signed(data.fan_photo_path),
    fanPhotoBackUrl: await signed((data as { fan_photo_back_path?: string | null }).fan_photo_back_path ?? null),
    secondIdPhotoUrl: await signed(data.second_id_photo_path),
    bankOwnerIdPhotoUrl: await signed(data.bank_owner_id_photo_path),
    cohortDetail: cohortRow
      ? {
          id: cohortRow.id,
          name: cohortRow.name,
          code: cohortRow.code,
          venue: cohortRow.venue,
          startsOn: cohortRow.starts_on,
          endsOn: cohortRow.ends_on,
          description: cohortRow.description,
          status: cohortRow.status,
          capacity: cohortRow.capacity,
        }
      : {
          id: null,
          name: cohortCode,
          code: cohortCode,
          venue: null,
          startsOn: null,
          endsOn: null,
          description: null,
          status: null,
          capacity: null,
        },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  const { id } = await params;
  const { body, form } = await parseBody(request);
  const updates: Record<string, unknown> = {};

  const action = typeof body?.action === 'string' ? body.action : '';
  if (action === 'approve' || action === 'approved') updates.review_status = 'approved';
  else if (action === 'review') updates.review_status = 'review';
  else if (action === 'flag' || action === 'flagged') updates.review_status = 'flagged';
  else if (action === 'pending') updates.review_status = 'pending';
  else if (isAdminStatus(action)) updates.review_status = action;

  const reasonRaw = body?.reason ?? body?.review_note ?? body?.reviewNote;
  if (typeof reasonRaw === 'string') {
    updates.review_note = reasonRaw.trim().slice(0, 2000);
  } else if (updates.review_status && (body?.reason === null || body?.review_note === null)) {
    updates.review_note = '';
  }

  for (const key of UPDATABLE) {
    if (body?.[key] === undefined) continue;
    const value = body[key];
    if (BOOLEAN_FIELDS.has(key)) {
      const parsed = parseBoolean(value);
      if (parsed === null) {
        return NextResponse.json({ error: 'INVALID_BOOLEAN', field: key }, { status: 400 });
      }
      updates[key] = parsed;
      continue;
    }
    if (key === 'health_subsectors') {
      if (Array.isArray(value)) {
        updates[key] = value.map(String).filter(Boolean);
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) updates[key] = [];
        else if (trimmed.startsWith('[')) {
          try {
            updates[key] = (JSON.parse(trimmed) as unknown[]).map(String).filter(Boolean);
          } catch {
            updates[key] = trimmed.split(',').map((item) => item.trim()).filter(Boolean);
          }
        } else {
          updates[key] = trimmed.split(',').map((item) => item.trim()).filter(Boolean);
        }
      }
      continue;
    }
    if (key === 'second_id_type' || key === 'second_id_number' || key === 'secondary_phone' || key === 'whatsapp_number' || key === 'middle_name') {
      updates[key] = value === '' || value == null ? null : value;
      continue;
    }
    updates[key] = value;
  }

  if (body?.review_status && isAdminStatus(String(body.review_status))) {
    updates.review_status = body.review_status;
  }

  if (updates.age !== undefined) {
    const age = Number(updates.age);
    if (!Number.isInteger(age)) {
      return NextResponse.json({ error: 'INVALID_AGE' }, { status: 400 });
    }
    updates.age = age;
  }

  const supabase = getSupabaseAdmin();

  if (form) {
    for (const photo of PHOTO_FIELDS) {
      const clearKey = `clear_${photo.formKey}`;
      if (String(body[clearKey] ?? '') === 'true') {
        updates[photo.column] = null;
        continue;
      }
      const file = form.get(photo.formKey);
      if (!file || typeof file === 'string') continue;
      const attachment = file as File;
      if (!attachment.size) continue;
      const extension = extensionForMime(attachment.type);
      const objectPath = `admin-${id}${photo.suffix}-${Date.now()}.${extension}`;
      const uploaded = await uploadVolunteerPhoto(attachment, objectPath, { imagesOnly: photo.imagesOnly });
      if ('error' in uploaded) {
        return NextResponse.json(
          { error: uploaded.error },
          { status: uploaded.error === 'UPLOAD_FAILED' ? 500 : 400 },
        );
      }
      updates[photo.column] = uploaded.path;
    }
  }

  const languages = parseLanguages(body.languages);
  const hasFieldUpdates = Object.keys(updates).length > 0;
  const hasLanguageUpdates = languages !== null;

  if (!hasFieldUpdates && !hasLanguageUpdates) {
    return NextResponse.json({ error: 'NO_UPDATES' }, { status: 400 });
  }

  let data: { id: string; review_status: string | null; email_status: string | null; device_flag: string | null } | null = null;

  if (hasFieldUpdates) {
    const result = await supabase
      .from('registrations')
      .update(updates)
      .eq('id', id)
      .select('id, review_status, email_status, device_flag')
      .maybeSingle();
    if (result.error || !result.data) {
      console.error('admin_registration_patch_error', result.error);
      return NextResponse.json({ error: 'UPDATE_FAILED', details: result.error?.message }, { status: 500 });
    }
    data = result.data;
  } else {
    const result = await supabase
      .from('registrations')
      .select('id, review_status, email_status, device_flag')
      .eq('id', id)
      .maybeSingle();
    if (result.error || !result.data) {
      return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    }
    data = result.data;
  }

  if (hasLanguageUpdates && languages) {
    const { error: deleteError } = await supabase.from('registration_languages').delete().eq('registration_id', id);
    if (deleteError) {
      console.error('admin_registration_languages_delete_error', deleteError);
      return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 });
    }
    if (languages.length) {
      const { error: insertError } = await supabase.from('registration_languages').insert(
        languages.map((row) => ({
          registration_id: id,
          language_group: row.language_group,
          language: row.language,
          proficiency: row.proficiency,
        })),
      );
      if (insertError) {
        console.error('admin_registration_languages_insert_error', insertError);
        return NextResponse.json({ error: 'UPDATE_FAILED' }, { status: 500 });
      }
    }
  }

  const reviewStatus = typeof updates.review_status === 'string' ? updates.review_status : data.review_status;
  const reviewNote = typeof updates.review_note === 'string' ? updates.review_note : undefined;
  const changedKeys = Object.keys(updates);
  await logActivity({
    actor: gate.session,
    action: changedKeys.includes('review_status') ? `volunteer.${reviewStatus || 'update'}` : 'volunteer.update',
    summary: changedKeys.includes('review_status')
      ? `${gate.session.fullName} set volunteer status to ${reviewStatus}${reviewNote ? `: ${reviewNote.slice(0, 120)}` : ''}`
      : `${gate.session.fullName} updated a volunteer record`,
    entityType: 'registration',
    entityId: id,
    metadata: {
      fields: changedKeys,
      reviewStatus,
      reviewNote: reviewNote || undefined,
      languagesUpdated: hasLanguageUpdates,
    },
    request,
  });

  return NextResponse.json({
    id: data.id,
    status: deriveAdminStatus(data.review_status, data.email_status, data.device_flag),
    reviewNote: reviewNote ?? null,
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
  await logActivity({
    actor: gate.session,
    action: 'volunteer.delete',
    summary: `${gate.session.fullName} deleted a volunteer registration`,
    entityType: 'registration',
    entityId: id,
    request,
  });
  return NextResponse.json({ ok: true });
}
