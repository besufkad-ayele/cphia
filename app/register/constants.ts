import {
  ETHIOPIAN_LANGUAGES,
  UN_LANGUAGES,
  NATIONALITIES,
  ETHIOPIA_REGIONS,
  EDUCATION_LEVELS,
  HEALTH_SUBSECTORS,
  SECTORS,
} from '@cphia/shared/constants';

export const nationalityOptions = [...NATIONALITIES];

export const professionSuggestions = [
  'Public Health Officer',
  'Medical Doctor',
  'Nurse',
  'Pharmacist',
  'Laboratory Scientist',
  'Researcher',
  'Health Informatics Specialist',
  'Community Health Worker',
  'Event Management',
  'Communications & Media',
  'Logistics Officer',
  'Protocol Officer',
  'Student',
  'Other',
] as const;

export const ethiopianLanguages = [...ETHIOPIAN_LANGUAGES];
export const unOfficialLanguages = [...UN_LANGUAGES];
export const sectorOptions = [...SECTORS];
export const healthSubsectorOptions = [...HEALTH_SUBSECTORS];
export const regionOptions = [...ETHIOPIA_REGIONS];
export const educationOptions = [...EDUCATION_LEVELS];

export const secondIdTypeOptions = ['Passport', 'Kebele ID', "Driver's license", 'Other'] as const;
