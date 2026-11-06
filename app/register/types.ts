import type { AppLocale } from './i18n';
import type { EDUCATION_LEVELS, SECOND_ID_TYPES, SECTORS } from '@cphia/shared/constants';

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
  age: number | '';
  nationality: string;
  fanNumber: string;
  secondIdType: '' | (typeof SECOND_ID_TYPES)[number];
  secondIdNumber: string;
  phone: string;
  secondaryPhone: string;
  phoneIsWhatsApp: boolean | null;
  whatsappNumber: string;
  whatsappNo: boolean;
  email: string;
  confirmEmail: string;
  residenceRegion: string;
  residenceCity: string;
  residenceDetail: string;
  profession: string;
  educationLevel: '' | (typeof EDUCATION_LEVELS)[number];
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  languages: LanguageRow[];
  sector: '' | (typeof SECTORS)[number];
  healthSubsectors: string[];
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankAccountOtherOwner: boolean;
  ureportRegistered: boolean | null;
  uiLanguage: AppLocale;
};

export type StoredPhoto = {
  fileName: string;
  blob: Blob;
  size: number;
  type: string;
};
