import { z } from 'zod';

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number');

export const emailSchema = z.string().trim().email();

export const fanNumberSchema = z
  .string()
  .trim()
  .regex(/^[A-Z0-9]{8,20}$/i, 'Invalid FAN number');

export const registrationLanguageSchema = z.object({
  group: z.enum(['ethiopian', 'un', 'other']),
  language: z.string().min(1).max(100),
  proficiency: z.enum(['Basic', 'Conversational', 'Fluent', 'Native']),
});

export const registrationSchema = z.object({
  firstName: z.string().min(1).max(80),
  middleName: z.string().max(80).optional().or(z.literal('')),
  lastName: z.string().min(1).max(80),
  fullNameAmharic: z.string().min(1).max(160),
  sex: z.enum(['Male', 'Female']),
  age: z.number().int().min(18).max(70),
  nationality: z.string().min(1).max(100).default('Ethiopia'),
  fanNumber: fanNumberSchema,
  secondIdType: z.enum(['Passport', 'Kebele ID', 'Driver\'s license', 'Other']).optional(),
  secondIdNumber: z.string().max(80).optional().or(z.literal('')),
  phone: phoneSchema,
  phoneIsWhatsApp: z.boolean(),
  whatsappNumber: phoneSchema.optional().or(z.literal('')),
  noWhatsapp: z.boolean().default(false),
  email: emailSchema,
  confirmEmail: emailSchema,
  residenceRegion: z.string().min(1).max(80),
  residenceDetail: z.string().min(1).max(200),
  profession: z.string().max(120).optional().or(z.literal('')),
  educationLevel: z.enum(['Certificate', 'Diploma', 'Bachelor\'s', 'Master\'s', 'PhD', 'Other']),
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
  hasConsent: z.boolean().refine((value) => value === true, 'Consent is required'),
}).refine((data) => data.email === data.confirmEmail, {
  path: ['confirmEmail'],
  message: 'Emails do not match',
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
