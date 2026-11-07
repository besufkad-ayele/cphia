import { NextRequest, NextResponse } from 'next/server';
import { registrationSchema } from '@cphia/shared/schemas';
import { logActivity } from '@/app/lib/admin/activity';
import { sendRegistrationEmail } from '@/app/lib/email/registration';
import {
  REGISTER_ERROR_MESSAGES,
  formatInvalidInputMessage,
  mapRpcFailure,
  messageForRegisterCode,
} from '@/app/lib/registration-errors';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';
import { extensionForMime, uploadVolunteerPhoto } from '@/app/lib/storage/volunteer-photos';

export const runtime = 'nodejs';

const DUPLICATE_CODES = new Set(['DUPLICATE_EMAIL', 'DUPLICATE_PHONE', 'DUPLICATE_FAN', 'DUPLICATE_DEVICE', 'DUPLICATE']);

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    {
      error,
      message: messageForRegisterCode(error),
      ...extra,
    },
    { status },
  );
}

async function uploadAttachment(
  file: File,
  objectPath: string,
  options?: { imagesOnly?: boolean },
) {
  const uploaded = await uploadVolunteerPhoto(file, objectPath, options);
  if ('error' in uploaded) return { error: uploaded.error };
  return { path: uploaded.path };
}

function toRpcPayload(
  parsed: ReturnType<typeof registrationSchema.parse>,
  photoPath: string,
  ureportPath: string | null,
  fanPhotoPath: string | null,
  fanPhotoBackPath: string | null,
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
    fan_photo_back_path: fanPhotoBackPath,
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

function parseJsonField(raw: FormDataEntryValue, field: string) {
  try {
    return { value: JSON.parse(String(raw)) as unknown };
  } catch {
    return {
      error: NextResponse.json(
        {
          error: 'INVALID_INPUT',
          message: `${field} data is damaged. Go back, re-check that section, and try again.`,
          details: { fieldErrors: { [field]: ['Invalid data. Please re-enter this section.'] } },
        },
        { status: 400 },
      ),
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/size|large|limit|413/i.test(message)) {
        return jsonError('BODY_TOO_LARGE', 413);
      }
      return NextResponse.json(
        {
          error: 'INVALID_INPUT',
          message: 'Could not read the submitted form. Please try again with smaller photos if needed.',
        },
        { status: 400 },
      );
    }

    const payload: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (
        key === 'photo'
        || key === 'ureportScreenshot'
        || key === 'fanPhoto'
        || key === 'fanPhotoBack'
        || key === 'secondIdPhoto'
        || key === 'bankOwnerIdPhoto'
      ) continue;
      if (key === 'languages' || key === 'healthSubsectors') {
        const parsedField = parseJsonField(value, key);
        if ('error' in parsedField) return parsedField.error;
        payload[key] = parsedField.value;
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
      const details = parsed.error.flatten();
      return NextResponse.json(
        {
          error: 'INVALID_INPUT',
          message: formatInvalidInputMessage(details),
          details,
        },
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
      if (!attachment.size) return { error: missingCode };
      const extension = extensionForMime(attachment.type);
      return uploadAttachment(attachment, `${registration.idempotencyKey}${suffix}.${extension}`, options);
    }

    const uploaded = await requireUpload('photo', '', 'PHOTO_REQUIRED');
    if ('error' in uploaded) {
      const code = String(uploaded.error || 'REGISTRATION_FAILED');
      return jsonError(code, code === 'UPLOAD_FAILED' ? 502 : 400);
    }

    const fanUploaded = await requireUpload('fanPhoto', '-fan', 'FAN_PHOTO_REQUIRED');
    if ('error' in fanUploaded) {
      const code = String(fanUploaded.error || 'REGISTRATION_FAILED');
      return jsonError(code, code === 'UPLOAD_FAILED' ? 502 : 400);
    }

    let fanBackPath: string | null = null;
    const fanBackFile = formData.get('fanPhotoBack');
    if (fanBackFile && typeof fanBackFile !== 'string' && (fanBackFile as File).size) {
      const attachment = fanBackFile as File;
      const extension = extensionForMime(attachment.type);
      const fanBackUploaded = await uploadAttachment(attachment, `${registration.idempotencyKey}-fan-back.${extension}`);
      if ('error' in fanBackUploaded) {
        const code = String(fanBackUploaded.error || 'REGISTRATION_FAILED');
        return jsonError(code, code === 'UPLOAD_FAILED' ? 502 : 400);
      }
      fanBackPath = fanBackUploaded.path;
    }

    let secondIdPath: string | null = null;
    if (registration.secondIdType && registration.secondIdNumber) {
      const secondUploaded = await requireUpload('secondIdPhoto', '-second-id', 'SECOND_ID_PHOTO_REQUIRED');
      if ('error' in secondUploaded) {
        const code = String(secondUploaded.error || 'REGISTRATION_FAILED');
        return jsonError(code, code === 'UPLOAD_FAILED' ? 502 : 400);
      }
      secondIdPath = secondUploaded.path;
    }

    let bankOwnerPath: string | null = null;
    if (registration.bankAccountOtherOwner) {
      const ownerUploaded = await requireUpload('bankOwnerIdPhoto', '-bank-owner', 'BANK_OWNER_ID_REQUIRED');
      if ('error' in ownerUploaded) {
        const code = String(ownerUploaded.error || 'REGISTRATION_FAILED');
        return jsonError(code, code === 'UPLOAD_FAILED' ? 502 : 400);
      }
      bankOwnerPath = ownerUploaded.path;
    }

    let ureportPath: string | null = null;
    if (registration.ureportRegistered) {
      const ureportUpload = await requireUpload('ureportScreenshot', '-ureport', 'UREPORT_SCREENSHOT_REQUIRED');
      if ('error' in ureportUpload) {
        const code = String(ureportUpload.error || 'REGISTRATION_FAILED');
        return jsonError(code, code === 'UPLOAD_FAILED' ? 502 : 400);
      }
      ureportPath = ureportUpload.path;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('register_volunteer', {
      payload: toRpcPayload(registration, uploaded.path, ureportPath, fanUploaded.path, fanBackPath, secondIdPath, bankOwnerPath),
    });

    if (error) {
      console.error('register_rpc_error', error);
      const mapped = mapRpcFailure(error);
      return NextResponse.json(
        { error: mapped.error, message: mapped.message, details: error.message },
        { status: mapped.status },
      );
    }

    const result = data as { registrationId?: string; error?: string } | null;
    if (result?.error) {
      if (result.error === 'INVALID_FAN') return jsonError('INVALID_FAN', 400);
      if (DUPLICATE_CODES.has(result.error)) return jsonError(result.error, 409);
      return NextResponse.json(
        {
          error: result.error,
          message: messageForRegisterCode(result.error, `Registration failed (${result.error}). Please try again.`),
        },
        { status: 400 },
      );
    }

    if (!result?.registrationId) {
      return NextResponse.json(
        {
          error: 'REGISTRATION_FAILED',
          message: 'Registration saved incompletely and no ID was returned. Please try again or contact support.',
        },
        { status: 500 },
      );
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

    await logActivity({
      actorName: 'Public registration',
      actorEmail: registration.email,
      action: 'registration.submit',
      summary: `${registration.firstName} ${registration.lastName} submitted a public registration (${result.registrationId})`,
      entityType: 'registration',
      entityId: result.registrationId,
      metadata: {
        registrationId: result.registrationId,
        sector: registration.sector,
        emailSent,
      },
      request,
    });

    return NextResponse.json({ registrationId: result.registrationId, emailSent }, { status: 201 });
  } catch (error) {
    console.error('register_error', error);
    const message = error instanceof Error ? error.message : '';
    if (/FormData|parse|JSON/i.test(message)) {
      return NextResponse.json(
        {
          error: 'INVALID_INPUT',
          message: 'Could not read the submitted form. Please refresh and try again.',
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: 'REGISTRATION_FAILED',
        message: REGISTER_ERROR_MESSAGES.REGISTRATION_FAILED,
      },
      { status: 500 },
    );
  }
}
