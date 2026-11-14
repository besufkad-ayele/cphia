import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { registrationSchema } from '@cphia/shared/schemas';
import { logActivity } from '@/app/lib/admin/activity';
import { requireFeature } from '@/app/lib/admin/guard';
import {
  applyNameSort,
  applyRegistrationFilters,
  fetchAllPaged,
  parseSector,
  parseSubsector,
  registrationStatusMetrics,
  sanitizeSearch,
} from '@/app/lib/admin/registration-filters';
import { deriveAdminStatus, isAdminStatus } from '@/app/lib/admin/status';
import { formatVolunteerName, type RegistrationSummary } from '@/app/lib/admin/types';
import {
  formatInvalidInputMessage,
  mapRpcFailure,
  messageForRegisterCode,
} from '@/app/lib/registration-errors';
import { extensionForMime, uploadVolunteerPhoto } from '@/app/lib/storage/volunteer-photos';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { error, message: messageForRegisterCode(error), ...extra },
    { status },
  );
}

type RegistrationRow = {
  id: string;
  registration_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  sector: string;
  health_subsectors: string[] | null;
  role_subsectors: string[] | null;
  residence_region: string;
  email_status: string | null;
  device_flag: string | null;
  review_status: string | null;
  review_note: string | null;
  created_at: string;
  ui_language: string | null;
  phone: string | null;
  secondary_phone: string | null;
  fan_number: string | null;
  bank_name: string | null;
  cohort: string | null;
};

function toSummary(row: RegistrationRow): RegistrationSummary {
  const firstName = row.first_name ?? '';
  const middleName = row.middle_name ?? '';
  const lastName = row.last_name ?? '';
  return {
    id: row.id,
    registrationId: row.registration_id,
    firstName,
    middleName,
    lastName,
    name: formatVolunteerName({ firstName, middleName, lastName }),
    email: row.email,
    phone: row.phone ?? '',
    secondaryPhone: row.secondary_phone ?? '',
    fanNumber: row.fan_number ?? '',
    sector: row.sector,
    healthSubsectors: row.health_subsectors ?? [],
    roleSubsectors: row.role_subsectors ?? [],
    residenceRegion: row.residence_region,
    status: deriveAdminStatus(row.review_status, row.email_status, row.device_flag),
    reviewNote: row.review_note ?? '',
    createdAt: row.created_at,
    uiLanguage: row.ui_language ?? 'en',
    deviceFlag: row.device_flag,
    bankName: row.bank_name ?? '',
    cohort: row.cohort ?? 'CPHIA-26',
  };
}

const SELECT_COLS =
  'id, registration_id, first_name, middle_name, last_name, email, sector, health_subsectors, role_subsectors, residence_region, email_status, device_flag, review_status, review_note, created_at, ui_language, phone, secondary_phone, fan_number, bank_name, cohort';

export async function GET(request: NextRequest) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  const url = request.nextUrl;
  const statusParam = url.searchParams.get('status');
  const searchParam = url.searchParams.get('search');
  const mode = url.searchParams.get('mode');
  const page = Math.max(1, Number(url.searchParams.get('page') || 1));
  const pageSize = Math.min(mode === 'index' ? 20000 : 100, Math.max(10, Number(url.searchParams.get('pageSize') || 25)));
  const status = statusParam && isAdminStatus(statusParam) ? statusParam : null;
  const search = searchParam ? sanitizeSearch(searchParam) : '';
  const sector = parseSector(url.searchParams.get('sector'));
  const subsector = parseSubsector(url.searchParams.get('subsector'));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const filters = { status, search: mode === 'index' ? '' : search, sector, subsector };

  try {
    const supabase = getSupabaseAdmin();

    function buildListQuery() {
      let query = supabase.from('registrations').select(SELECT_COLS, { count: 'exact' });
      query = applyNameSort(query as never) as typeof query;
      query = applyRegistrationFilters(query as never, filters) as typeof query;
      return query;
    }

    if (mode === 'index') {
      const [{ rows, total }, metrics] = await Promise.all([
        fetchAllPaged<RegistrationRow>(() => buildListQuery() as never),
        registrationStatusMetrics(supabase, { search: '', sector, subsector }),
      ]);

      return NextResponse.json({
        registrations: rows.map((row) => toSummary(row)),
        metrics,
        page: 1,
        pageSize: rows.length,
        total,
        mode: 'index',
        filters: { sector, subsector, status, search: '' },
      });
    }

    const [{ data, error, count }, metrics] = await Promise.all([
      buildListQuery().range(from, to),
      registrationStatusMetrics(supabase, { search, sector, subsector }),
    ]);

    if (error) {
      console.error('admin_registrations_error', error);
      return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
    }

    return NextResponse.json({
      registrations: ((data ?? []) as RegistrationRow[]).map((row) => toSummary(row)),
      metrics,
      page,
      pageSize,
      total: count ?? 0,
      mode: 'page',
      filters: { sector, subsector, status, search },
    });
  } catch (error) {
    console.error('admin_registrations_error', error);
    return NextResponse.json({ error: 'FETCH_FAILED' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gate = await requireFeature(request, 'volunteers');
  if (!gate.ok) return gate.error;

  try {
    const formData = await request.formData();
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
        payload[key] = JSON.parse(String(value));
        continue;
      }
      if (
        key === 'agree'
        || key === 'phoneIsWhatsApp'
        || key === 'whatsappNo'
        || key === 'ureportRegistered'
        || key === 'bankAccountOtherOwner'
      ) {
        payload[key] = String(value) === 'true';
        continue;
      }
      payload[key] = value;
    }

    if (!payload.idempotencyKey) payload.idempotencyKey = crypto.randomUUID();
    if (payload.agree === undefined) payload.agree = true;
    if (payload.confirmEmail === undefined) payload.confirmEmail = payload.email;
    if (payload.uiLanguage === undefined) payload.uiLanguage = 'en';

    const parsed = registrationSchema.safeParse(payload);
    if (!parsed.success) {
      const details = parsed.error.flatten();
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: formatInvalidInputMessage(details), details },
        { status: 400 },
      );
    }

    const registration = parsed.data;
    const reviewStatus = isAdminStatus(String(formData.get('reviewStatus') || ''))
      ? String(formData.get('reviewStatus'))
      : 'approved';

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
      return uploadVolunteerPhoto(attachment, `admin-new-${registration.idempotencyKey}${suffix}.${extension}`, options);
    }

    const uploaded = await requireUpload('photo', '', 'PHOTO_REQUIRED', { imagesOnly: true });
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
      const fanBackUploaded = await uploadVolunteerPhoto(attachment, `admin-new-${registration.idempotencyKey}-fan-back.${extension}`);
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

    const fan = registration.fanNumber.replace(/\s/g, '');
    const rpcPayload = {
      first_name: registration.firstName,
      middle_name: registration.middleName || null,
      last_name: registration.lastName,
      full_name_amharic:
        registration.fullNameAmharic.trim() || `${registration.firstName} ${registration.lastName}`.trim(),
      sex: registration.sex,
      age: registration.age,
      nationality: registration.nationality,
      fan_number: fan,
      second_id_type: registration.secondIdType || null,
      second_id_number: registration.secondIdNumber || null,
      photo_path: uploaded.path,
      fan_photo_path: fanUploaded.path,
      fan_photo_back_path: fanBackPath,
      second_id_photo_path: secondIdPath,
      phone: registration.phone,
      secondary_phone: registration.secondaryPhone || null,
      phone_is_whatsapp: registration.phoneIsWhatsApp,
      whatsapp_number: registration.whatsappNumber || null,
      no_whatsapp: registration.whatsappNo,
      email: registration.email,
      residence_region: registration.residenceRegion,
      residence_detail: `${registration.residenceCity}, ${registration.residenceDetail}`.replace(/^, /, ''),
      profession: registration.profession,
      education_level: registration.educationLevel,
      emergency_name: registration.emergencyName,
      emergency_phone: registration.emergencyPhone,
      emergency_relationship: registration.emergencyRelationship,
      sector: registration.sector,
      health_subsectors: registration.healthSubsectors,
      bank_name: registration.bankName,
      bank_account_name: registration.bankAccountName,
      bank_account_number: registration.bankAccountNumber,
      bank_account_other_owner: registration.bankAccountOtherOwner,
      bank_owner_id_photo_path: bankOwnerPath,
      ureport_registered: registration.ureportRegistered,
      ureport_screenshot_path: ureportPath,
      ui_language: registration.uiLanguage,
      idempotency_key: registration.idempotencyKey,
      device_token_hash: null,
      device_fingerprint_hash: null,
      languages: registration.languages
        .filter((language) => language.selected && language.language.trim().length > 0)
        .map((language) => ({
          group: language.group,
          language: language.language,
          proficiency: language.proficiency,
        })),
    };

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('register_volunteer', { payload: rpcPayload });
    if (error) {
      console.error('admin_register_rpc_error', error);
      const mapped = mapRpcFailure(error);
      return NextResponse.json(
        { error: mapped.error, message: mapped.message, details: error.message },
        { status: mapped.status },
      );
    }

    const result = data as { registrationId?: string; id?: string; error?: string } | null;
    if (result?.error) {
      return jsonError(result.error, result.error.startsWith('DUPLICATE') ? 409 : 400);
    }
    if (!result?.registrationId) {
      return jsonError('REGISTRATION_FAILED', 500);
    }

    if (reviewStatus !== 'pending') {
      await supabase
        .from('registrations')
        .update({ review_status: reviewStatus, email_status: 'pending' })
        .eq('registration_id', result.registrationId);
    }

    const personName = `${registration.firstName} ${registration.lastName}`.trim();
    await logActivity({
      actor: gate.session,
      action: 'volunteer.create',
      summary: `${gate.session.fullName} registered ${personName} (${result.registrationId})`,
      entityType: 'registration',
      entityId: result.id || result.registrationId,
      subject: {
        id: result.id || null,
        registrationId: result.registrationId,
        name: personName,
      },
      metadata: { registrationId: result.registrationId, reviewStatus, sector: registration.sector, publicId: result.registrationId, personName },
      request,
    });

    return NextResponse.json(
      { registrationId: result.registrationId, id: result.id, status: reviewStatus },
      { status: 201 },
    );
  } catch (error) {
    console.error('admin_register_error', error);
    return jsonError('REGISTRATION_FAILED', 500);
  }
}
