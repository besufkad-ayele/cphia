export const ETHIOPIAN_LANGUAGES = [
  'Amharic',
  'Afaan Oromo',
  'Tigrigna',
  'Somali',
  'Afar',
  'Sidama',
  'Wolaytta',
  'Gurage',
  'Hadiyya',
  'Gamo',
  'Kembata',
] as const;

export const UN_LANGUAGES = [
  'Arabic',
  'Chinese',
  'English',
  'French',
  'Russian',
  'Spanish',
  'Kiswahili',
  'Portuguese',
  'Hausa',
] as const;

export const INTERNATIONAL_LANGUAGES = UN_LANGUAGES;

export type LanguageGroup = 'ethiopian' | 'un' | 'other';

export const PROFICIENCY_LEVELS = [
  'Basic',
  'Conversational',
  'Fluent',
  'Native',
] as const;

export type ProficiencyLevel = (typeof PROFICIENCY_LEVELS)[number];

export const APP_LANGUAGES = ['en', 'am', 'om', 'ti'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];
