export const SECTORS = [
  'Health',
  'Tourism',
  'Culture and Sport',
  'MoFA',
  'UNICEF',
  'Ethiopian Youth Council',
  'Serve Global',
  'U-Report',
  'Transport',
  'Other',
] as const;

export type Sector = (typeof SECTORS)[number];

/** Older / loose labels that should map onto the canonical SECTORS list. */
const SECTOR_ALIASES: Record<string, Sector> = {
  'u-report': 'U-Report',
  'ureport': 'U-Report',
  'u report': 'U-Report',
  'serve global': 'Serve Global',
  serveglobal: 'Serve Global',
  'ethiopian youth council': 'Ethiopian Youth Council',
  'ethiopian youth councle': 'Ethiopian Youth Council',
  'youth council': 'Ethiopian Youth Council',
  'culture and sport': 'Culture and Sport',
  'culture & sport': 'Culture and Sport',
  mofa: 'MoFA',
  unicef: 'UNICEF',
};

/** Trim + fold aliases so filters match what is stored on older registrations. */
export function normalizeSector(value: string | null | undefined): Sector | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  const exact = (SECTORS as readonly string[]).find((sector) => sector === trimmed);
  if (exact) return exact as Sector;
  const folded = trimmed.toLowerCase();
  const caseMatch = (SECTORS as readonly string[]).find((sector) => sector.toLowerCase() === folded);
  if (caseMatch) return caseMatch as Sector;
  return SECTOR_ALIASES[folded] ?? null;
}

export function sectorsMatch(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizeSector(a);
  const right = normalizeSector(b);
  if (left && right) return left === right;
  return String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
}

export const HEALTH_SUBSECTORS = [
  'Public Health',
  'Food Safety',
  'Pre-facility',
  'Facility',
] as const;

export type HealthSubsector = (typeof HEALTH_SUBSECTORS)[number];

/** Duty / role sub-sectors for assignment sectors (incl. Other). */
export const ROLE_SUBSECTORS = [
  'Tourism',
  'Transport',
  'MoFA',
  'Culture and Sport',
] as const;

export type RoleSubsector = (typeof ROLE_SUBSECTORS)[number];

/** Top-level sectors that get ROLE_SUBSECTORS multi-select (not Tourism/Transport/etc as primary). */
export const ROLE_ASSIGNMENT_SECTORS = [
  'UNICEF',
  'U-Report',
  'Serve Global',
  'Ethiopian Youth Council',
  'Other',
] as const;

export type RoleAssignmentSector = (typeof ROLE_ASSIGNMENT_SECTORS)[number];

export function isRoleAssignmentSector(value: string | null | undefined): value is RoleAssignmentSector {
  const sector = normalizeSector(value);
  return !!sector && (ROLE_ASSIGNMENT_SECTORS as readonly string[]).includes(sector);
}

export function isHealthSector(value: string | null | undefined) {
  return normalizeSector(value) === 'Health';
}

/** Sectors that expose a sub-sector multi-select in admin. */
export function sectorHasSubsectors(value: string | null | undefined) {
  return isHealthSector(value) || isRoleAssignmentSector(value);
}

export function subsectorOptionsForSector(value: string | null | undefined): readonly string[] {
  if (isHealthSector(value)) return HEALTH_SUBSECTORS;
  if (isRoleAssignmentSector(value)) return ROLE_SUBSECTORS;
  return [];
}

export function subsectorFieldForSector(value: string | null | undefined): 'health_subsectors' | 'role_subsectors' | null {
  if (isHealthSector(value)) return 'health_subsectors';
  if (isRoleAssignmentSector(value)) return 'role_subsectors';
  return null;
}

export function subsectorLabelForSector(value: string | null | undefined) {
  if (isHealthSector(value)) return 'Health sub-sector';
  if (isRoleAssignmentSector(value)) return 'Sub-sector';
  return 'Sub-sector';
}

export function isKnownSubsector(value: string | null | undefined) {
  if (!value) return false;
  return (
    (HEALTH_SUBSECTORS as readonly string[]).includes(value) ||
    (ROLE_SUBSECTORS as readonly string[]).includes(value)
  );
}

export const EDUCATION_LEVELS = [
  'Certificate',
  'Diploma',
  "Bachelor's",
  "Master's",
  'PhD',
  'Other',
] as const;

export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const SECOND_ID_TYPES = [
  'Passport',
  'Kebele ID',
  "Driver's license",
  'Other',
] as const;

export type SecondIdType = (typeof SECOND_ID_TYPES)[number];
