import { deriveAdminStatus, type AdminStatus } from '@/app/lib/admin/status';
import { organizePhone } from '@/app/register/lib/phone';

export const STATUS_SUPPORT_EMAIL = 'ayebesufkad3@gmail.com';
/** Display / dial format for volunteer desk WhatsApp. */
export const STATUS_SUPPORT_WHATSAPP = '+251974208084';
/** Digits only for wa.me links. */
export const STATUS_SUPPORT_WHATSAPP_DIGITS = '251974208084';

export type PublicApplicationStatus = AdminStatus;

export type PublicStatusResult = {
  registrationId: string;
  firstName: string;
  status: PublicApplicationStatus;
  title: string;
  message: string;
  reason: string | null;
  sector: string | null;
  /** Combined health / role sub-sectors when present. */
  subsector: string | null;
  supportEmail: string;
  supportWhatsApp: string;
};

function formatSubsectors(
  health?: string[] | null,
  roles?: string[] | null,
) {
  const values = [...(health ?? []), ...(roles ?? [])]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  if (!values.length) return null;
  return [...new Set(values)].join(', ');
}

/** Normalize public ID: accept CPHIA-26-123456 or bare 6-digit tail. */
export function normalizeRegistrationId(raw: string) {
  const compact = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[_/]/g, '-');
  if (!compact) return '';
  if (/^CPHIA-26-\d{6}$/.test(compact)) return compact;
  const digits = compact.replace(/\D/g, '');
  if (/^\d{6}$/.test(digits)) return `CPHIA-26-${digits}`;
  // Soft fix: CPHIA26-123456 / CPHIA-26123456
  const match = compact.match(/CPHIA-?26-?(\d{6})$/);
  if (match) return `CPHIA-26-${match[1]}`;
  return compact;
}

export function normalizeLookupPhone(raw: string) {
  const organized = organizePhone(String(raw || '').trim());
  if (!organized || organized === '+251') return '';
  return organized;
}

/** Digits-only form for loose equality against stored variants. */
export function phoneDigits(value: string) {
  return String(value || '').replace(/\D/g, '');
}

export function phonesMatch(stored: string | null | undefined, lookupE164: string) {
  if (!stored || !lookupE164) return false;
  const left = phoneDigits(stored);
  const right = phoneDigits(lookupE164);
  if (!left || !right) return false;
  if (left === right) return true;
  // Compare local 9-digit tails (Ethiopia mobile).
  const leftTail = left.slice(-9);
  const rightTail = right.slice(-9);
  return leftTail.length === 9 && leftTail === rightTail;
}

export function publicStatusCopy(status: PublicApplicationStatus, firstName: string): {
  title: string;
  message: string;
} {
  const name = firstName.trim() || 'Volunteer';
  if (status === 'approved') {
    return {
      title: 'Approved',
      message: `${name}, your CPHIA 2026 volunteer application has been approved. Keep your registration ID safe — you will need it for briefing and attendance.`,
    };
  }
  if (status === 'review') {
    return {
      title: 'Needs updates',
      message: `${name}, your application needs a few updates before it can be approved. Read the reason below, then email us with the corrected details.`,
    };
  }
  if (status === 'flagged') {
    return {
      title: 'Not selected',
      message: `${name}, your application was not selected for this intake. If you believe this is a mistake or want to share more information, email the volunteer desk.`,
    };
  }
  return {
    title: 'Under review',
    message: `${name}, we have received your application and it is still under review. Check again soon, or email us if you need help.`,
  };
}

export function buildPublicStatusPayload(row: {
  registration_id: string;
  first_name: string | null;
  review_status: string | null;
  email_status?: string | null;
  device_flag?: string | null;
  review_note?: string | null;
  sector?: string | null;
  health_subsectors?: string[] | null;
  role_subsectors?: string[] | null;
}): PublicStatusResult {
  const status = deriveAdminStatus(row.review_status, row.email_status, row.device_flag);
  const firstName = String(row.first_name || '').trim();
  const copy = publicStatusCopy(status, firstName);
  const reason =
    status === 'review' || status === 'flagged'
      ? String(row.review_note || '').trim() || null
      : null;

  return {
    registrationId: row.registration_id,
    firstName,
    status,
    title: copy.title,
    message: copy.message,
    reason,
    sector: row.sector || null,
    subsector: formatSubsectors(row.health_subsectors, row.role_subsectors),
    supportEmail: STATUS_SUPPORT_EMAIL,
    supportWhatsApp: STATUS_SUPPORT_WHATSAPP,
  };
}

export function supportMailto(options?: {
  registrationId?: string;
  status?: string;
  subject?: string;
}) {
  const subject =
    options?.subject
    || (options?.registrationId
      ? `CPHIA volunteer status · ${options.registrationId}`
      : 'CPHIA 2026 volunteer application');
  const lines = [
    'Hello volunteer desk,',
    '',
    options?.registrationId ? `Registration ID: ${options.registrationId}` : null,
    options?.status ? `Status shown: ${options.status}` : null,
    '',
    'I would like to…',
    '',
  ].filter((line) => line !== null);
  const body = lines.join('\n');
  return `mailto:${STATUS_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function supportWhatsAppLink(options?: {
  registrationId?: string;
  status?: string;
}) {
  const lines = [
    'Hello volunteer desk,',
    '',
    options?.registrationId ? `Registration ID: ${options.registrationId}` : null,
    options?.status ? `Status shown: ${options.status}` : null,
    '',
    'I would like to…',
    '',
  ].filter((line) => line !== null);
  return `https://wa.me/${STATUS_SUPPORT_WHATSAPP_DIGITS}?text=${encodeURIComponent(lines.join('\n'))}`;
}
