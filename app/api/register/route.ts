import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const languageSchema = z.object({
  language: z.string().min(1),
  selected: z.boolean().default(false),
  proficiency: z.enum(['Basic', 'Conversational', 'Fluent', 'Native']).default('Basic'),
});

const registrationSchema = z.object({
  agree: z.boolean().optional().default(false),
  firstName: z.string().min(1),
  middleName: z.string().optional().or(z.literal('')),
  lastName: z.string().min(1),
  fullNameAmharic: z.string().min(1),
  sex: z.enum(['Male', 'Female']),
  age: z.coerce.number().int().min(18).max(70),
  nationality: z.string().default('Ethiopia'),
  fanNumber: z.string().min(1),
  secondIdType: z.string().optional().or(z.literal('')),
  secondIdNumber: z.string().optional().or(z.literal('')),
  phone: z.string().min(5),
  phoneIsWhatsApp: z.coerce.boolean().default(true),
  whatsappNumber: z.string().optional().or(z.literal('')),
  whatsappNo: z.coerce.boolean().optional().default(false),
  email: z.string().email(),
  confirmEmail: z.string().email(),
  residenceRegion: z.string().min(1),
  residenceCity: z.string().min(1),
  residenceDetail: z.string().min(1),
  profession: z.string().optional().or(z.literal('')),
  educationLevel: z.string().min(1),
  emergencyName: z.string().min(1),
  emergencyPhone: z.string().min(5),
  emergencyRelationship: z.string().min(1),
  languages: z.array(languageSchema).min(1),
  sector: z.string().min(1),
  healthSubsectors: z.array(z.string()).default([]),
  idempotencyKey: z.string().uuid().optional(),
  deviceTokenHash: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (key === 'languages' || key === 'healthSubsectors') {
        payload[key] = JSON.parse(String(value));
        continue;
      }

      if (key === 'agree' || key === 'phoneIsWhatsApp') {
        payload[key] = String(value) === 'true';
        continue;
      }

      payload[key] = value;
    }

    const parsed = registrationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'INVALID_INPUT',
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (data.email !== data.confirmEmail) {
      return NextResponse.json({ error: 'EMAIL_MISMATCH' }, { status: 400 });
    }

    if (!data.languages.some((item) => item.selected)) {
      return NextResponse.json({ error: 'LANGUAGE_REQUIRED' }, { status: 400 });
    }

    const photo = formData.get('photo');
    if (photo && typeof photo !== 'string') {
      const file = photo as File;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature = Array.from(bytes.slice(0, 12)).map((b) => b.toString(16).padStart(2, '0')).join('');
      const isJpg = signature.startsWith('ffd8ff');
      const isPng = signature.startsWith('89504e470d0a1a0a');
      const isWebp = signature.startsWith('52494646') && signature.slice(8, 16).toLowerCase() === '57454250';

      if (!allowedMimeTypes.has(file.type) || (!isJpg && !isPng && !isWebp)) {
        return NextResponse.json({ error: 'INVALID_PHOTO' }, { status: 400 });
      }

      if (file.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: 'PHOTO_TOO_LARGE' }, { status: 400 });
      }
    }

    return NextResponse.json({ registrationId: 'CPHIA-26-000001' }, { status: 201 });
  } catch (error) {
    console.error('register_error', error);
    return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
  }
}
