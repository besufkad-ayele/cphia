import type { AppLocale } from './i18n';

export type Proficiency = 'Basic' | 'Conversational' | 'Fluent' | 'Native';

export type LanguageRow = {
  id: string;
  group: 'ethiopian' | 'un' | 'other';
  language: string;
  selected: boolean;
  proficiency: Proficiency;
};

export type RegisterFormValues = {
  agree: boolean;
  firstName: string;
  middleName: string;
  lastName: string;
  amharicFirstName: string;
  amharicMiddleName: string;
  amharicLastName: string;
  fullNameAmharic: string;
  sex: 'Male' | 'Female' | '';
  age: string;
  nationality: string;
  fanNumber: string;
  secondIdType: '' | 'Passport' | 'Kebele ID' | "Driver's license" | 'Other';
  secondIdNumber: string;
  phone: string;
  phoneIsWhatsApp: boolean | null;
  whatsappNumber: string;
  whatsappNo: boolean;
  email: string;
  confirmEmail: string;
  residenceRegion: string;
  residenceCity: string;
  residenceDetail: string;
  profession: string;
  educationLevel: '' | 'Certificate' | 'Diploma' | "Bachelor's" | "Master's" | 'PhD' | 'Other';
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  languages: LanguageRow[];
  sector: '' | 'Health' | 'Tourism' | 'Culture and Sport' | 'MoFA' | 'Transport';
  healthSubsectors: string[];
  uiLanguage: AppLocale;
};

export type StoredPhoto = {
  fileName: string;
  blob: Blob;
  size: number;
  type: string;
};
