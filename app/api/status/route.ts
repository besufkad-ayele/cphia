import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  buildPublicStatusPayload,
  normalizeLookupPhone,
  normalizeRegistrationId,
  phonesMatch,
} from '@/app/lib/public-status';
import { getSupabaseAdmin } from '@/app/lib/supabase/server';

export const runtime = 'nodejs';

const GENERIC_NOT_FOUND = {
  error: 'NOT_FOUND',
  message: 'No application matched that registration ID and phone number.',
};

function badRequest(message: string) {
  return NextResponse.json({ error: 'INVALID', message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const registrationId = normalizeRegistrationId(String(body.registrationId ?? body.id ?? ''));
  const phone = normalizeLookupPhone(String(body.phone ?? body.number ?? ''));

  if (!registrationId || !/^CPHIA-26-\d{6}$/.test(registrationId)) {
    return badRequest('Enter your registration ID (for example CPHIA-26-123456).');
  }
  if (!phone || phone.length < 12) {
    return badRequest('Enter the phone number you used when you registered.');
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('registrations')
      .select('registration_id, first_name, review_status, email_status, device_flag, review_note, sector, phone, secondary_phone')
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (error) {
      console.error('public_status_lookup_error', error);
      return NextResponse.json({ error: 'LOOKUP_FAILED', message: 'Could not check status right now.' }, { status: 500 });
    }

    // Same generic response whether ID is missing or phone does not match (anti-enumeration).
    if (!data) {
      return NextResponse.json(GENERIC_NOT_FOUND, { status: 404 });
    }

    const phoneOk =
      phonesMatch(data.phone, phone)
      || phonesMatch(data.secondary_phone, phone);
    if (!phoneOk) {
      return NextResponse.json(GENERIC_NOT_FOUND, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      result: buildPublicStatusPayload(data),
    });
  } catch (error) {
    console.error('public_status_error', error);
    return NextResponse.json({ error: 'LOOKUP_FAILED', message: 'Could not check status right now.' }, { status: 500 });
  }
}
