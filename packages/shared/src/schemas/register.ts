import { z } from 'zod';
import { EDUCATION_LEVELS, HEALTH_SUBSECTORS, SECOND_ID_TYPES, SECTORS } from '../constants/sectors';

export const proficiencySchema = z.enum(['Basic', 'Conversational', 'Fluent', 'Native']);

export const phoneSchema = z
  .string()
  .trim()
  .refine(
    (value) => /^\+?[0-9][0-9\s]{9,19}$/.test(value) && !/[A-Za-z]/.test(value),
    'Invalid phone number',
  );

export const emailSchema = z.string().trim().email();

export const fanNumberSchema = z
  .string()
  .trim()
  .refine((value) => {
    const digits = value.replace(/\s/g, '');
    return digits === '' || /^\d{10,20}$/.test(digits);
  }, 'Invalid FAN number');

export const registrationLanguageSchema = z.object({
  id: z.string().min(1),
  group: z.enum(['ethiopian', 'un', 'other']),
  language: z.string().min(1).max(100),
  selected: z.boolean(),
  proficiency: proficiencySchema,
});

const sectorEnum = z.enum(SECTORS);
const healthSubsectorEnum = z.enum(HEALTH_SUBSECTORS);
const educationEnum = z.enum(EDUCATION_LEVELS);
const secondIdEnum = z.enum(SECOND_ID_TYPES);

export const registrationSchema = z.object({
  agree: z.boolean().refine((value) => value === true, 'Consent is required'),
  firstName: z.string().min(1).max(80),
  middleName: z.string().max(80).optional().or(z.literal('')),
  lastName: z.string().min(1).max(80),
  fullNameAmharic: z.string().min(1).max(160),
  sex: z.enum(['Male', 'Female']),
  age: z.coerce.number().int().min(18).max(70),
  nationality: z.string().min(1).max(100),
  fanNumber: fanNumberSchema,
  secondIdType: secondIdEnum.optional().or(z.literal('')),
  secondIdNumber: z.string().max(80).optional().or(z.literal('')),
  phone: phoneSchema,
  phoneIsWhatsApp: z.boolean(),
  whatsappNumber: phoneSchema.optional().or(z.literal('')),
  whatsappNo: z.boolean().default(false),
  email: emailSchema,
  confirmEmail: emailSchema,
  residenceRegion: z.string().min(1).max(80),
  residenceCity: z.string().min(1).max(80),
  residenceDetail: z.string().min(1).max(200),
  profession: z.string().min(1).max(120),
  educationLevel: educationEnum,
  emergencyName: z.string().min(1).max(120),
  emergencyPhone: phoneSchema,
  emergencyRelationship: z.string().min(1).max(80),
  languages: z.array(registrationLanguageSchema).min(1),
  sector: sectorEnum,
  healthSubsectors: z.array(healthSubsectorEnum).default([]),
  uiLanguage: z.enum(['en', 'am', 'om', 'ti']).default('en'),
  idempotencyKey: z.string().uuid(),
  deviceTokenHash: z.string().optional(),
  deviceFingerprintHash: z.string().optional(),
  photo: z.any().optional(),
}).refine((data) => data.email === data.confirmEmail, {
  path: ['confirmEmail'],
  message: 'Emails do not match',
}).refine((data) => data.languages.some((language) => language.selected && language.language.trim().length > 0), {
  path: ['languages'],
  message: 'At least one language must be selected',
}).refine((data) => data.sector !== 'Health' || data.healthSubsectors.length > 0, {
  path: ['healthSubsectors'],
  message: 'Select at least one health sub-sector',
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
