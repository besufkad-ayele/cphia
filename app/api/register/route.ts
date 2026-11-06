import { NextRequest, NextResponse } from 'next/server';
import { registrationSchema } from '@cphia/shared/schemas';
import { sendRegistrationEmail } from '@/app/lib/email/registration';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const portraitMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
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

function isPdf(signature: string) {
  return signature.startsWith('25504446');
}

function fileSignature(bytes: Uint8Array) {
  return Array.from(bytes.slice(0, 12))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function looksLikeImage(bytes: Uint8Array) {
  const signature = fileSignature(bytes);
  return isJpg(signature) || isPng(signature) || isWebp(signature);
}

function looksLikeAllowedFile(bytes: Uint8Array, mimeType: string) {
  const signature = fileSignature(bytes);
  if (mimeType === 'application/pdf') return isPdf(signature);
  return looksLikeImage(bytes);
}

function extensionForMime(mimeType: string) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

async function uploadAttachment(
  file: File,
  objectPath: string,
  options?: { imagesOnly?: boolean },
) {
  if (file.size > MAX_PHOTO_BYTES) return { error: 'PHOTO_TOO_LARGE' as const };
  const allowed = options?.imagesOnly ? portraitMimeTypes : allowedMimeTypes;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!allowed.has(file.type) || !looksLikeAllowedFile(bytes, file.type)) {
    return { error: 'INVALID_PHOTO' as const };
  }
  if (options?.imagesOnly && !looksLikeImage(bytes)) {
    return { error: 'INVALID_PHOTO' as const };
  }
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from('volunteer-photos').upload(objectPath, bytes, {
    contentType: file.type,
    upsert: true,
  });
  if (error) {
    console.error('register_photo_upload_error', error);
    return { error: 'REGISTRATION_FAILED' as const };
  }
  return { path: objectPath };
}

function toRpcPayload(
  parsed: ReturnType<typeof registrationSchema.parse>,
  photoPath: string,
  ureportPath: string | null,
  fanPhotoPath: string | null,
  secondIdPhotoPath: string | null,
  bankOwnerIdPhotoPath: string | null,
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
    fan_number: fan,
    second_id_type: parsed.secondIdType || null,
    second_id_number: parsed.secondIdNumber || null,
    photo_path: photoPath,
    fan_photo_path: fanPhotoPath,
    second_id_photo_path: secondIdPhotoPath,
    phone: parsed.phone,
    secondary_phone: parsed.secondaryPhone || null,
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
    bank_name: parsed.bankName,
    bank_account_name: parsed.bankAccountName,
    bank_account_number: parsed.bankAccountNumber,
    bank_account_other_owner: parsed.bankAccountOtherOwner,
    bank_owner_id_photo_path: bankOwnerIdPhotoPath,
    ureport_registered: parsed.ureportRegistered,
    ureport_screenshot_path: ureportPath,
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
      if (key === 'photo' || key === 'ureportScreenshot' || key === 'fanPhoto' || key === 'secondIdPhoto' || key === 'bankOwnerIdPhoto') continue;
      if (key === 'languages' || key === 'healthSubsectors') {
        payload[key] = JSON.parse(String(value));
        continue;
      }
      if (key === 'agree' || key === 'phoneIsWhatsApp' || key === 'whatsappNo' || key === 'ureportRegistered' || key === 'bankAccountOtherOwner') {
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

    const registration = parsed.data;

    async function requireUpload(
      field: string,
      suffix: string,
      missingCode: string,
      options?: { imagesOnly?: boolean },
    ) {
      const file = formData.get(field);
      if (!file || typeof file === 'string') return { error: missingCode };
      const attachment = file as File;
      const extension = extensionForMime(attachment.type);
      return uploadAttachment(attachment, `${registration.idempotencyKey}${suffix}.${extension}`, options);
    }

    const uploaded = await requireUpload('photo', '', 'PHOTO_REQUIRED', { imagesOnly: true });
    if ('error' in uploaded) {
      return NextResponse.json({ error: uploaded.error }, { status: uploaded.error === 'REGISTRATION_FAILED' ? 500 : 400 });
    }

    const fanUploaded = await requireUpload('fanPhoto', '-fan', 'FAN_PHOTO_REQUIRED');
    if ('error' in fanUploaded) {
      return NextResponse.json({ error: fanUploaded.error }, { status: fanUploaded.error === 'REGISTRATION_FAILED' ? 500 : 400 });
    }

    let secondIdPath: string | null = null;
    if (registration.secondIdType && registration.secondIdNumber) {
      const secondUploaded = await requireUpload('secondIdPhoto', '-second-id', 'SECOND_ID_PHOTO_REQUIRED');
      if ('error' in secondUploaded) {
        return NextResponse.json({ error: secondUploaded.error }, { status: secondUploaded.error === 'REGISTRATION_FAILED' ? 500 : 400 });
      }
      secondIdPath = secondUploaded.path;
    }

    let bankOwnerPath: string | null = null;
    if (registration.bankAccountOtherOwner) {
      const ownerUploaded = await requireUpload('bankOwnerIdPhoto', '-bank-owner', 'BANK_OWNER_ID_REQUIRED');
      if ('error' in ownerUploaded) {
        return NextResponse.json({ error: ownerUploaded.error }, { status: ownerUploaded.error === 'REGISTRATION_FAILED' ? 500 : 400 });
      }
      bankOwnerPath = ownerUploaded.path;
    }

    let ureportPath: string | null = null;
    if (registration.ureportRegistered) {
      const ureportUpload = await requireUpload('ureportScreenshot', '-ureport', 'UREPORT_SCREENSHOT_REQUIRED');
      if ('error' in ureportUpload) {
        return NextResponse.json({ error: ureportUpload.error }, { status: ureportUpload.error === 'REGISTRATION_FAILED' ? 500 : 400 });
      }
      ureportPath = ureportUpload.path;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('register_volunteer', {
      payload: toRpcPayload(registration, uploaded.path, ureportPath, fanUploaded.path, secondIdPath, bankOwnerPath),
    });

    if (error) {
      console.error('register_rpc_error', error);
      return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
    }

    const result = data as { registrationId?: string; error?: string } | null;
    if (result?.error) {
      if (result.error === 'INVALID_FAN') {
        return NextResponse.json({ error: 'INVALID_FAN' }, { status: 400 });
      }
      if (DUPLICATE_CODES.has(result.error)) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
    }

    if (!result?.registrationId) {
      return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
    }

    const emailSent = await sendRegistrationEmail({
      to: registration.email,
      registrationId: result.registrationId,
      firstName: registration.firstName,
      lastName: registration.lastName,
      sector: registration.sector,
    });

    const { error: emailStatusError } = await supabase
      .from('registrations')
      .update({ email_status: emailSent ? 'sent' : 'failed' })
      .eq('registration_id', result.registrationId);
    if (emailStatusError) {
      console.error('registration_email_status_error', emailStatusError);
    }

    return NextResponse.json({ registrationId: result.registrationId, emailSent }, { status: 201 });
  } catch (error) {
    console.error('register_error', error);
    return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
  }
}
