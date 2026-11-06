import { NextRequest, NextResponse } from 'next/server';
import { registrationSchema } from '@cphia/shared/schemas';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DUPLICATE_CODES = new Set(['DUPLICATE_EMAIL', 'DUPLICATE_PHONE', 'DUPLICATE_FAN', 'DUPLICATE_DEVICE', 'DUPLICATE']);

function isJpg(signature: string) {
  return signature.startsWith('ffd8ff');
}

function isPng(signature: string) {
  return signature.startsWith('89504e470d0a1a0a');
}

function isWebp(signature: string) {
  return signature.startsWith('52494646') && signature.slice(16, 24).toLowerCase() === '57454250';
}

function toRpcPayload(
  parsed: ReturnType<typeof registrationSchema.parse>,
  photoPath: string | null,
) {
  const fan = parsed.fanNumber.replace(/\s/g, '');
  return {
    first_name: parsed.firstName,
    middle_name: parsed.middleName || null,
    last_name: parsed.lastName,
    full_name_amharic:
      parsed.fullNameAmharic.trim() || `${parsed.firstName} ${parsed.lastName}`.trim(),
    sex: parsed.sex,
    age: parsed.age,
    nationality: parsed.nationality,
    fan_number: fan || null,
    second_id_type: parsed.secondIdType || null,
    second_id_number: parsed.secondIdNumber || null,
    photo_path: photoPath,
    phone: parsed.phone,
    phone_is_whatsapp: parsed.phoneIsWhatsApp,
    whatsapp_number: parsed.whatsappNumber || null,
    no_whatsapp: parsed.whatsappNo,
    email: parsed.email,
    residence_region: parsed.residenceRegion,
    residence_detail: `${parsed.residenceCity}, ${parsed.residenceDetail}`.replace(/^, /, ''),
    profession: parsed.profession,
    education_level: parsed.educationLevel,
    emergency_name: parsed.emergencyName,
    emergency_phone: parsed.emergencyPhone,
    emergency_relationship: parsed.emergencyRelationship,
    sector: parsed.sector,
    health_subsectors: parsed.healthSubsectors,
    ui_language: parsed.uiLanguage,
    idempotency_key: parsed.idempotencyKey,
    device_token_hash: parsed.deviceTokenHash || null,
    device_fingerprint_hash: parsed.deviceFingerprintHash || null,
    languages: parsed.languages
      .filter((language) => language.selected && language.language.trim().length > 0)
      .map((language) => ({
        group: language.group,
        language: language.language,
        proficiency: language.proficiency,
      })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (key === 'photo') continue;
      if (key === 'languages' || key === 'healthSubsectors') {
        payload[key] = JSON.parse(String(value));
        continue;
      }
      if (key === 'agree' || key === 'phoneIsWhatsApp' || key === 'whatsappNo') {
        payload[key] = String(value) === 'true';
        continue;
      }
      payload[key] = value;
    }

    const parsed = registrationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'INVALID_INPUT', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const photo = formData.get('photo');
    let photoPath: string | null = null;

    if (photo && typeof photo !== 'string') {
      const file = photo as File;
      if (file.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: 'PHOTO_TOO_LARGE' }, { status: 400 });
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature = Array.from(bytes.slice(0, 12))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const looksValid = isJpg(signature) || isPng(signature) || isWebp(signature);

      if (!allowedMimeTypes.has(file.type) || !looksValid) {
        return NextResponse.json({ error: 'INVALID_PHOTO' }, { status: 400 });
      }

      const supabase = getSupabaseAdmin();
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const objectPath = `${parsed.data.idempotencyKey}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('volunteer-photos')
        .upload(objectPath, bytes, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        console.error('register_photo_upload_error', uploadError);
        return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
      }

      photoPath = objectPath;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('register_volunteer', {
      payload: toRpcPayload(parsed.data, photoPath),
    });

    if (error) {
      console.error('register_rpc_error', error);
      return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
    }

    const result = data as { registrationId?: string; error?: string } | null;
    if (result?.error) {
      if (DUPLICATE_CODES.has(result.error)) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
    }

    if (!result?.registrationId) {
      return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
    }

    return NextResponse.json({ registrationId: result.registrationId }, { status: 201 });
  } catch (error) {
    console.error('register_error', error);
    return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
  }
}
