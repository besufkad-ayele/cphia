import { z } from 'zod';

const phoneField = z.string().trim().min(5, 'Enter a valid phone number').max(20, 'Phone number is too long');
const optionalPhoneField = z.union([phoneField, z.literal('')]).default('');

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
  age: z.union([z.number().int().min(18).max(70), z.string().regex(/^\d{1,2}$/).transform(Number), z.literal('')]).default(''),
  nationality: z.string().min(1, 'Nationality is required').max(100),
  fanNumber: z.string().trim().refine((value) => {
    const digits = value.replace(/\s/g, '');
    return digits === '' || /^\d{10,20}$/.test(digits);
  }, 'Enter at least 10 digits').default(''),
  secondIdType: z.union([z.enum(['Passport', 'Kebele ID', "Driver's license", 'Other']), z.literal('')]).default(''),
  secondIdNumber: z.string().max(80).default(''),
  phone: phoneField,
  phoneIsWhatsApp: z.boolean().nullable().default(null),
  whatsappNumber: optionalPhoneField,
  whatsappNo: z.boolean().default(false),
  email: z.string().trim().email('Enter a valid email'),
  confirmEmail: z.string().trim().email('Enter a valid email'),
  residenceRegion: z.string().min(1, 'Region is required').max(80),
  residenceCity: z.string().min(1, 'City is required').max(80),
  residenceDetail: z.string().min(1, 'Address is required').max(200),
  profession: z.string().min(1, 'Profession is required').max(120),
  educationLevel: z.union([
    z.enum(['Certificate', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Other']),
    z.literal(''),
  ]).default(''),
  emergencyName: z.string().min(1, 'Emergency contact name is required').max(120),
  emergencyPhone: phoneField,
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
  sector: z.union([
    z.enum(['Health', 'Tourism', 'Culture and Sport', 'MoFA', 'Transport']),
    z.literal(''),
  ]).default(''),
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
  sex: z.enum(['Male', 'Female', ''], { required_error: 'Sex is required' }),
  age: z.union([z.number().int().min(18).max(70), z.string().regex(/^\d{1,2}$/).transform(Number), z.literal('')]).default(''),
  nationality: z.string().min(1, 'Nationality is required').max(100),
  fanNumber: z.string().trim().refine((value) => {
    const digits = value.replace(/\s/g, '');
    return digits === '' || /^\d{10,20}$/.test(digits);
  }, 'Enter at least 10 digits').default(''),
  phone: phoneField,
  phoneIsWhatsApp: z.boolean().nullable().default(null),
  whatsappNumber: optionalPhoneField,
  email: z.string().trim().email('Enter a valid email'),
  confirmEmail: z.string().trim().email('Enter a valid email'),
  residenceRegion: z.string().min(1, 'Region is required').max(80),
  residenceCity: z.string().min(1, 'City is required').max(80),
  residenceDetail: z.string().min(1, 'Address is required').max(200),
}).refine((data) => data.email === data.confirmEmail, {
  path: ['confirmEmail'],
  message: 'Emails do not match',
});

export const backgroundStepSchema = z.object({
  profession: z.string().min(1, 'Profession is required').max(120),
  educationLevel: z.union([
    z.enum(['Certificate', 'Diploma', "Bachelor's", "Master's", 'PhD', 'Other']),
    z.literal(''),
  ]).default(''),
  emergencyName: z.string().min(1, 'Emergency contact name is required').max(120),
  emergencyPhone: phoneField,
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
  sector: z.union([
    z.enum(['Health', 'Tourism', 'Culture and Sport', 'MoFA', 'UNICEF']),
    z.literal(''),
  ]).default(''),
  healthSubsectors: z.array(z.string()).default([]),
}).refine(
  (data) => data.sector !== 'Health' || data.healthSubsectors.length > 0,
  {
    path: ['healthSubsectors'],
    message: 'Select at least one health sub-sector',
  },
);

export function toSubmissionPayload(values: any, idempotencyKey: string) {
  return {
    ...values,
    fullNameAmharic:
      values.fullNameAmharic ||
      [values.amharicFirstName, values.amharicMiddleName, values.amharicLastName].filter(Boolean).join(' '),
    age: Number(values.age),
    phoneIsWhatsApp: Boolean(values.phoneIsWhatsApp),
    whatsappNumber: values.phoneIsWhatsApp ? '' : values.whatsappNumber,
    idempotencyKey,
  };
}
