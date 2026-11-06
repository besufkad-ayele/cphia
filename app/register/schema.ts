import { z } from 'zod';
import { ALL_BANKS, EDUCATION_LEVELS, HEALTH_SUBSECTORS, SECOND_ID_TYPES, SECTORS } from '@cphia/shared/constants';
import { phoneSchema } from '@cphia/shared/schemas';
import { organizePhone } from './lib/phone';
import type { RegisterFormValues } from './types';

const optionalPhoneField = z.union([phoneSchema, z.literal('')]).default('');
const sectorEnum = z.enum([...SECTORS] as [string, ...string[]]);
const educationEnum = z.enum([...EDUCATION_LEVELS] as [string, ...string[]]);
const secondIdEnum = z.enum([...SECOND_ID_TYPES] as [string, ...string[]]);
const healthEnum = z.enum([...HEALTH_SUBSECTORS] as [string, ...string[]]);
const bankEnum = z.enum([...ALL_BANKS] as [string, ...string[]]);

const fanSchema = z.string().trim().refine((value) => /^\d{16}$/.test(value.replace(/\s/g, '')), 'FAN must be 16 digits');

export const registerFormSchema = z.object({
  agree: z.boolean().refine((value) => value === true, 'Consent is required'),
  firstName: z.string().min(1, 'First name is required').max(80),
  middleName: z.string().max(80).default(''),
  lastName: z.string().min(1, 'Last name is required').max(80),
  amharicFirstName: z.string().max(80).default(''),
  amharicMiddleName: z.string().max(80).default(''),
  amharicLastName: z.string().max(80).default(''),
  fullNameAmharic: z.string().max(160).default(''),
  sex: z.enum(['Male', 'Female', ''], { required_error: 'Sex is required' }),
  age: z.union([z.number().int().min(18).max(70), z.literal('')]).default(''),
  nationality: z.string().min(1, 'Nationality is required').max(100),
  fanNumber: fanSchema,
  secondIdType: z.union([secondIdEnum, z.literal('')]).default(''),
  secondIdNumber: z.string().max(80).default(''),
  phone: phoneSchema,
  secondaryPhone: optionalPhoneField,
  phoneIsWhatsApp: z.boolean().nullable().default(null),
  whatsappNumber: optionalPhoneField,
  whatsappNo: z.boolean().default(false),
  email: z.string().trim().email('Enter a valid email'),
  confirmEmail: z.string().trim().email('Enter a valid email'),
  residenceRegion: z.string().min(1, 'Region is required').max(80),
  residenceCity: z.string().min(1, 'City is required').max(80),
  residenceDetail: z.string().min(1, 'Address is required').max(200),
  profession: z.string().min(1, 'Profession is required').max(120),
  educationLevel: z.union([educationEnum, z.literal('')]).default(''),
  emergencyName: z.string().min(1, 'Emergency contact name is required').max(120),
  emergencyPhone: phoneSchema,
  emergencyRelationship: z.string().min(1, 'Relationship is required').max(80),
  languages: z.array(
    z.object({
      id: z.string().min(1),
      group: z.enum(['ethiopian', 'un', 'other']),
      language: z.string().min(1, 'Language name required').max(100),
      selected: z.boolean(),
      proficiency: z.enum(['Basic', 'Conversational', 'Fluent', 'Native']),
    }),
  ).min(1, 'Select at least one language'),
  sector: z.union([sectorEnum, z.literal('')]).default(''),
  healthSubsectors: z.array(z.string()).max(1).default([]),
  bankName: z.union([bankEnum, z.literal('')]).default(''),
  bankAccountName: z.string().max(120).default(''),
  bankAccountNumber: z.string().max(30).default(''),
  bankAccountOtherOwner: z.boolean().default(false),
  ureportRegistered: z.boolean().nullable().default(null),
  uiLanguage: z.enum(['en', 'am', 'om', 'ti']).default('en'),
})
  .refine((data) => data.email === data.confirmEmail, {
    path: ['confirmEmail'],
    message: 'Emails do not match',
  })
  .refine(
    (data) => data.languages.some((language) => language.selected && language.language.trim().length > 0),
    {
      path: ['languages'],
      message: 'Select at least one language',
    },
  )
  .refine(
    (data) => data.sector !== 'Health' || data.healthSubsectors.length === 1,
    {
      path: ['healthSubsectors'],
      message: 'Select one health sub-sector',
    },
  );

export const personalStepSchema = z.object({
  agree: z.boolean().refine((value) => value === true, 'Consent is required'),
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  amharicFirstName: z.string().max(80).default(''),
  amharicMiddleName: z.string().max(80).default(''),
  amharicLastName: z.string().max(80).default(''),
  fullNameAmharic: z.string().max(160).default(''),
  sex: z.enum(['Male', 'Female'], { required_error: 'Sex is required' }),
  age: z.coerce.number().int().min(18, 'Age must be 18 or older').max(70, 'Age must be 70 or younger'),
  nationality: z.string().min(1, 'Nationality is required').max(100),
  fanNumber: fanSchema,
  phone: phoneSchema,
  secondaryPhone: optionalPhoneField,
  phoneIsWhatsApp: z.boolean({ required_error: 'Tell us if this number is on WhatsApp' }),
  whatsappNumber: optionalPhoneField,
  whatsappNo: z.boolean().default(false),
  email: z.string().trim().email('Enter a valid email'),
  confirmEmail: z.string().trim().email('Enter a valid email'),
  residenceRegion: z.string().min(1, 'Region is required').max(80),
  residenceCity: z.string().min(1, 'City is required').max(80),
  residenceDetail: z.string().min(1, 'Address is required').max(200),
}).refine((data) => data.email === data.confirmEmail, {
  path: ['confirmEmail'],
  message: 'Emails do not match',
}).refine(
  (data) => data.phoneIsWhatsApp !== false || data.whatsappNo || (data.whatsappNumber?.trim().length ?? 0) > 5,
  {
    path: ['whatsappNumber'],
    message: 'Enter a WhatsApp number or confirm you have none',
  },
);

export const backgroundStepSchema = z.object({
  profession: z.string().min(1, 'Profession is required').max(120),
  educationLevel: educationEnum,
  emergencyName: z.string().min(1, 'Emergency contact name is required').max(120),
  emergencyPhone: phoneSchema,
  emergencyRelationship: z.string().min(1, 'Relationship is required').max(80),
  languages: z.array(
    z.object({
      id: z.string().min(1),
      group: z.enum(['ethiopian', 'un', 'other']),
      language: z.string().min(1, 'Language name required').max(100),
      selected: z.boolean(),
      proficiency: z.enum(['Basic', 'Conversational', 'Fluent', 'Native']),
    }),
  ).min(1, 'Select at least one language'),
}).refine(
  (data) => data.languages.some((language) => language.selected && language.language.trim().length > 0),
  {
    path: ['languages'],
    message: 'Select at least one language',
  },
);

export const reviewStepSchema = z.object({
  sector: sectorEnum,
  healthSubsectors: z.array(healthEnum).max(1).default([]),
  bankName: bankEnum,
  bankAccountName: z.string().min(1, 'Account owner name is required').max(120),
  bankAccountNumber: z.string().trim().min(5, 'Account number is required').max(30),
  bankAccountOtherOwner: z.boolean().default(false),
  ureportRegistered: z.boolean({ required_error: 'Tell us if you registered on U-Report' }),
}).refine(
  (data) => data.sector !== 'Health' || data.healthSubsectors.length === 1,
  {
    path: ['healthSubsectors'],
    message: 'Select one health sub-sector',
  },
);

export function toSubmissionPayload(values: RegisterFormValues, idempotencyKey: string) {
  return {
    agree: values.agree,
    firstName: values.firstName,
    middleName: values.middleName,
    lastName: values.lastName,
    fullNameAmharic:
      values.fullNameAmharic ||
      [values.amharicFirstName, values.amharicMiddleName, values.amharicLastName].filter(Boolean).join(' ') ||
      `${values.firstName} ${values.lastName}`.trim(),
    sex: values.sex,
    age: Number(values.age),
    nationality: values.nationality,
    fanNumber: values.fanNumber.replace(/\s/g, ''),
    secondIdType: values.secondIdType,
    secondIdNumber: values.secondIdNumber,
    phone: organizePhone(values.phone),
    secondaryPhone: values.secondaryPhone ? organizePhone(values.secondaryPhone) : '',
    phoneIsWhatsApp: Boolean(values.phoneIsWhatsApp),
    whatsappNumber: values.phoneIsWhatsApp ? '' : values.whatsappNumber ? organizePhone(values.whatsappNumber) : '',
    whatsappNo: values.whatsappNo,
    email: values.email,
    confirmEmail: values.confirmEmail,
    residenceRegion: values.residenceRegion,
    residenceCity: values.residenceCity,
    residenceDetail: values.residenceDetail,
    profession: values.profession,
    educationLevel: values.educationLevel,
    emergencyName: values.emergencyName,
    emergencyPhone: organizePhone(values.emergencyPhone),
    emergencyRelationship: values.emergencyRelationship,
    languages: values.languages,
    sector: values.sector,
    healthSubsectors: values.healthSubsectors,
    bankName: values.bankName,
    bankAccountName: values.bankAccountName,
    bankAccountNumber: values.bankAccountNumber,
    bankAccountOtherOwner: Boolean(values.bankAccountOtherOwner),
    ureportRegistered: Boolean(values.ureportRegistered),
    uiLanguage: values.uiLanguage,
    idempotencyKey,
  };
}

export type RegistrationSubmissionPayload = ReturnType<typeof toSubmissionPayload>;
