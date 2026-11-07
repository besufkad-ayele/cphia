import type { AdminStatus } from './status';

export const REVIEW_REASON_AREAS = [
  { id: 'basic', label: 'Basic info' },
  { id: 'contact', label: 'Contact' },
  { id: 'id', label: 'ID / FAN' },
  { id: 'photos', label: 'Photos & files' },
  { id: 'bank', label: 'Bank' },
  { id: 'languages', label: 'Languages' },
  { id: 'sector', label: 'Sector' },
  { id: 'emergency', label: 'Emergency contact' },
  { id: 'other', label: 'Other' },
] as const;

export type ReviewReasonAreaId = (typeof REVIEW_REASON_AREAS)[number]['id'];

export type ReviewComment = {
  id: string;
  at: string;
  status: string;
  note: string;
  actorName: string;
  areas: string[];
};

export function reviewAreaLabels(areaIds: string[]) {
  const lookup = new Map(REVIEW_REASON_AREAS.map((area) => [area.id, area.label]));
  return areaIds.map((id) => lookup.get(id as ReviewReasonAreaId) || id).filter(Boolean);
}

export function formatReviewReason(areaIds: string[], detail = '') {
  const labels = reviewAreaLabels(areaIds);
  const trimmed = detail.trim();
  if (labels.length && trimmed) return `Needs attention: ${labels.join(', ')}. ${trimmed}`;
  if (labels.length) return `Needs attention: ${labels.join(', ')}`;
  return trimmed;
}

export function parseReviewComments(value: unknown): ReviewComment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const areas = Array.isArray(row.areas)
        ? row.areas.map(String).map((id) => id.trim()).filter(Boolean)
        : [];
      const note = typeof row.note === 'string' ? row.note.trim() : '';
      if (!note && !areas.length) return null;
      return {
        id: typeof row.id === 'string' && row.id ? row.id : crypto.randomUUID(),
        at: typeof row.at === 'string' && row.at ? row.at : new Date().toISOString(),
        status: typeof row.status === 'string' ? row.status : '',
        note: note || formatReviewReason(areas),
        actorName: typeof row.actorName === 'string' ? row.actorName : '',
        areas,
      } satisfies ReviewComment;
    })
    .filter((item): item is ReviewComment => Boolean(item));
}

export type RegistrationSummary = {
  id: string;
  registrationId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  fanNumber: string;
  sector: string;
  healthSubsectors?: string[];
  residenceRegion: string;
  status: AdminStatus;
  reviewNote: string;
  createdAt: string;
  uiLanguage: string;
  deviceFlag: string | null;
  bankName: string;
  cohort: string;
};

/** Display Ethiopian-style: given name · father · grandfather */
export function formatVolunteerName(row: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}) {
  const first = (row.firstName ?? row.first_name ?? '').trim();
  const middle = (row.middleName ?? row.middle_name ?? '').trim();
  const last = (row.lastName ?? row.last_name ?? '').trim();
  return [first, middle, last].filter(Boolean).join(' ');
}

export type RegistrationMetrics = {
  total: number;
  pending: number;
  approved: number;
  review: number;
  flagged: number;
};

export type {
  AgeBucketRow,
  DemographicsSummary,
  EducationRow,
  GenderBySectorRow,
  GenderCount,
} from './demographics';

/** Columns available to every admin with volunteers access. */
export const EXPORT_COLUMNS = [
  { id: 'registration_id', label: 'Registration ID' },
  { id: 'first_name', label: 'Given name' },
  { id: 'middle_name', label: 'Father name' },
  { id: 'last_name', label: 'Grandfather name' },
  { id: 'full_name_amharic', label: 'Full name (Amharic)' },
  { id: 'sex', label: 'Gender' },
  { id: 'age', label: 'Age' },
  { id: 'nationality', label: 'Nationality' },
  { id: 'fan_number', label: 'FAN number' },
  { id: 'second_id_type', label: 'Second ID type' },
  { id: 'second_id_number', label: 'Second ID number' },
  { id: 'phone', label: 'Phone' },
  { id: 'secondary_phone', label: 'Secondary phone' },
  { id: 'whatsapp_number', label: 'WhatsApp' },
  { id: 'phone_is_whatsapp', label: 'Phone is WhatsApp' },
  { id: 'no_whatsapp', label: 'No WhatsApp' },
  { id: 'email', label: 'Email' },
  { id: 'residence_region', label: 'Region' },
  { id: 'residence_detail', label: 'Residence detail' },
  { id: 'profession', label: 'Profession' },
  { id: 'education_level', label: 'Education' },
  { id: 'languages', label: 'Languages' },
  { id: 'emergency_name', label: 'Emergency name' },
  { id: 'emergency_phone', label: 'Emergency phone' },
  { id: 'emergency_relationship', label: 'Emergency relationship' },
  { id: 'sector', label: 'Sector' },
  { id: 'health_subsectors', label: 'Health sub-sector' },
  { id: 'bank_name', label: 'Bank' },
  { id: 'bank_account_name', label: 'Account owner name' },
  { id: 'bank_account_number', label: 'Account number' },
  { id: 'bank_account_other_owner', label: 'Account owned by someone else' },
  { id: 'ureport_registered', label: 'U-Report registered' },
  { id: 'review_status', label: 'Status' },
  { id: 'review_note', label: 'Review note' },
  { id: 'email_status', label: 'Email status' },
  { id: 'device_flag', label: 'Device flag' },
  { id: 'ui_language', label: 'UI language' },
  { id: 'cohort', label: 'Cohort' },
  { id: 'created_at', label: 'Submitted' },
] as const;

/** Signed asset URL columns — export UI + API for super admins only. */
export const EXPORT_ASSET_COLUMNS = [
  { id: 'photo_url', label: 'Volunteer photo URL', pathKey: 'photo_path' },
  { id: 'fan_photo_url', label: 'National ID front URL', pathKey: 'fan_photo_path' },
  { id: 'fan_photo_back_url', label: 'National ID back URL', pathKey: 'fan_photo_back_path' },
  { id: 'second_id_photo_url', label: 'Second ID URL', pathKey: 'second_id_photo_path' },
  { id: 'bank_owner_id_photo_url', label: 'Account owner ID URL', pathKey: 'bank_owner_id_photo_path' },
  { id: 'ureport_url', label: 'U-Report screenshot URL', pathKey: 'ureport_screenshot_path' },
] as const;

export type ExportColumnId =
  | (typeof EXPORT_COLUMNS)[number]['id']
  | (typeof EXPORT_ASSET_COLUMNS)[number]['id'];

export const STAFF_PREVIEW_FIELDS = [
  { key: 'registration_id', label: 'Registration ID' },
  { key: 'first_name', label: 'Given name' },
  { key: 'middle_name', label: 'Father name' },
  { key: 'last_name', label: 'Grandfather name' },
  { key: 'sex', label: 'Gender' },
  { key: 'age', label: 'Age' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'fan_number', label: 'FAN number' },
  { key: 'sector', label: 'Sector' },
  { key: 'health_subsectors', label: 'Health sub-sector' },
  { key: 'residence_region', label: 'Region' },
  { key: 'profession', label: 'Profession' },
  { key: 'education_level', label: 'Education' },
  { key: 'cohort', label: 'Cohort' },
  { key: 'review_status', label: 'Status' },
  { key: 'review_note', label: 'Review note' },
] as const;

export const ASSET_SLOTS = [
  { key: 'photo', label: 'volunteer-photo', pathKey: 'photo_path', urlKey: 'photoUrl' },
  { key: 'fanPhoto', label: 'national-id-front', pathKey: 'fan_photo_path', urlKey: 'fanPhotoUrl' },
  { key: 'fanPhotoBack', label: 'national-id-back', pathKey: 'fan_photo_back_path', urlKey: 'fanPhotoBackUrl' },
  { key: 'secondIdPhoto', label: 'second-id', pathKey: 'second_id_photo_path', urlKey: 'secondIdPhotoUrl' },
  { key: 'bankOwnerIdPhoto', label: 'account-owner-id', pathKey: 'bank_owner_id_photo_path', urlKey: 'bankOwnerIdPhotoUrl' },
  { key: 'ureportScreenshot', label: 'ureport', pathKey: 'ureport_screenshot_path', urlKey: 'ureportUrl' },
] as const;
