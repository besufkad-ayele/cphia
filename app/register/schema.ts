import { z } from 'zod';
import { EDUCATION_LEVELS, HEALTH_SUBSECTORS, SECOND_ID_TYPES, SECTORS } from '@cphia/shared/constants';
import { phoneSchema } from '@cphia/shared/schemas';
import type { RegisterFormValues } from './types';

const optionalPhoneField = z.union([phoneSchema, z.literal('')]).default('');
const sectorEnum = z.enum([...SECTORS] as [string, ...string[]]);
const educationEnum = z.enum([...EDUCATION_LEVELS] as [string, ...string[]]);
const secondIdEnum = z.enum([...SECOND_ID_TYPES] as [string, ...string[]]);
const healthEnum = z.enum([...HEALTH_SUBSECTORS] as [string, ...string[]]);

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
  fanNumber: z.string().trim().refine((value) => {
    const digits = value.replace(/\s/g, '');
    return digits === '' || /^\d{10,20}$/.test(digits);
  }, 'Enter at least 10 digits').default(''),
  secondIdType: z.union([secondIdEnum, z.literal('')]).default(''),
  secondIdNumber: z.string().max(80).default(''),
  phone: phoneSchema,
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
  healthSubsectors: z.array(z.string()).default([]),
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
    (data) => data.sector !== 'Health' || data.healthSubsectors.length > 0,
    {
      path: ['healthSubsectors'],
      message: 'Select at least one health sub-sector',
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
  fanNumber: z.string().trim().refine((value) => {
    const digits = value.replace(/\s/g, '');
    return digits === '' || /^\d{10,20}$/.test(digits);
  }, 'Enter at least 10 digits').default(''),
  phone: phoneSchema,
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
  healthSubsectors: z.array(healthEnum).default([]),
}).refine(
  (data) => data.sector !== 'Health' || data.healthSubsectors.length > 0,
  {
    path: ['healthSubsectors'],
    message: 'Select at least one health sub-sector',
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
    phone: values.phone,
    phoneIsWhatsApp: Boolean(values.phoneIsWhatsApp),
    whatsappNumber: values.phoneIsWhatsApp ? '' : values.whatsappNumber,
    whatsappNo: values.whatsappNo,
    email: values.email,
    confirmEmail: values.confirmEmail,
    residenceRegion: values.residenceRegion,
    residenceCity: values.residenceCity,
    residenceDetail: values.residenceDetail,
    profession: values.profession,
    educationLevel: values.educationLevel,
    emergencyName: values.emergencyName,
    emergencyPhone: values.emergencyPhone,
    emergencyRelationship: values.emergencyRelationship,
    languages: values.languages,
    sector: values.sector,
    healthSubsectors: values.healthSubsectors,
    uiLanguage: values.uiLanguage,
    idempotencyKey,
  };
}

export type RegistrationSubmissionPayload = ReturnType<typeof toSubmissionPayload>;
