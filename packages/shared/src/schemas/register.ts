import { z } from 'zod';

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
  .refine((value) => value === '' || /^\d{10,20}$/.test(value), 'Invalid FAN number');

export const registrationLanguageSchema = z.object({
  id: z.string().min(1),
  group: z.enum(['ethiopian', 'un', 'other']),
  language: z.string().min(1).max(100),
  selected: z.boolean(),
  proficiency: proficiencySchema,
});

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
  secondIdType: z.enum(['Passport', 'Kebele ID', "Driver's license", 'Other']).optional().or(z.literal('')),
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
  educationLevel: z.enum(['Certificate', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Other']),
  emergencyName: z.string().min(1).max(120),
  emergencyPhone: phoneSchema,
  emergencyRelationship: z.string().min(1).max(80),
  languages: z.array(registrationLanguageSchema).min(1),
  sector: z.enum(['Health', 'Tourism', 'Culture and Sport', 'MoFA', 'UNICEF']),
  healthSubsectors: z.array(z.enum(['Public Health', 'Food Safety', 'Pre-facility', 'Facility'])).default([]),
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
