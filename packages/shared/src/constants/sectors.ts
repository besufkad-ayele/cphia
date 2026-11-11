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
