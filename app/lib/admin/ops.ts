export const COHORT_STATUSES = ['planning', 'open', 'active', 'closed'] as const;
export const FORM_STATUSES = ['draft', 'published', 'closed'] as const;
export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'] as const;
export const SHIFT_KINDS = ['training', 'ops'] as const;
export const SHEET_STATUSES = ['open', 'submitted', 'verified'] as const;
export const TEAM_STATUSES = ['active', 'archived'] as const;
export const TEAM_MEMBER_ROLES = ['member', 'zone_captain'] as const;
export const FIELD_TYPES = ['short_text', 'long_text', 'number', 'date', 'select', 'checkbox'] as const;

export type CohortStatus = (typeof COHORT_STATUSES)[number];
export type FormStatus = (typeof FORM_STATUSES)[number];
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export type ShiftKind = (typeof SHIFT_KINDS)[number];
export type SheetStatus = (typeof SHEET_STATUSES)[number];
export type TeamStatus = (typeof TEAM_STATUSES)[number];
export type TeamMemberRole = (typeof TEAM_MEMBER_ROLES)[number];
export type FieldType = (typeof FIELD_TYPES)[number];

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
};

export function isCohortStatus(value: string): value is CohortStatus {
  return (COHORT_STATUSES as readonly string[]).includes(value);
}

export function isFormStatus(value: string): value is FormStatus {
  return (FORM_STATUSES as readonly string[]).includes(value);
}

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export function isShiftKind(value: string): value is ShiftKind {
  return (SHIFT_KINDS as readonly string[]).includes(value);
}

export function isSheetStatus(value: string): value is SheetStatus {
  return (SHEET_STATUSES as readonly string[]).includes(value);
}

export function isTeamStatus(value: string): value is TeamStatus {
  return (TEAM_STATUSES as readonly string[]).includes(value);
}

export function isTeamMemberRole(value: string): value is TeamMemberRole {
  return (TEAM_MEMBER_ROLES as readonly string[]).includes(value);
}

export function cleanFields(value: unknown): FormField[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const type = (FIELD_TYPES as readonly string[]).includes(String(row.type)) ? (String(row.type) as FieldType) : 'short_text';
    const label = String(row.label ?? '').trim().slice(0, 160);
    if (!label) return [];
    const options = Array.isArray(row.options)
      ? row.options.map((option) => String(option).trim()).filter(Boolean).slice(0, 20)
      : [];
    const id = String(row.id || crypto.randomUUID()).replace(/[^\w-]/g, '').slice(0, 80) || crypto.randomUUID();
    return [{ id, label, type, required: Boolean(row.required), options: type === 'select' ? options : [] }];
  });
}

export function sanitizeSearch(value: string) {
  return value.replace(/[,.%()\\]/g, ' ').trim().slice(0, 80);
}
