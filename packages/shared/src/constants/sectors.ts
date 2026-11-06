export const SECTORS = [
  'Health',
  'Tourism',
  'Culture and Sport',
  'MoFA',
  'UNICEF',
  'Transport',
  'Other',
] as const;

export type Sector = (typeof SECTORS)[number];

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
