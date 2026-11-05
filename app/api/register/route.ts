import { NextRequest, NextResponse } from 'next/server';
import { registrationSchema } from '@cphia/shared/schemas';

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload: Record<string, unknown> = {};

    for (const [key, value] of formData.entries()) {
      if (key === 'languages' || key === 'healthSubsectors') {
        payload[key] = JSON.parse(String(value));
        continue;
      }

      if (key === 'agree' || key === 'phoneIsWhatsApp' || key === 'whatsappNo') {
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

    return NextResponse.json({ registrationId: `CPHIA-26-${Date.now().toString().slice(-6)}` }, { status: 201 });
  } catch (error) {
    console.error('register_error', error);
    return NextResponse.json({ error: 'REGISTRATION_FAILED' }, { status: 500 });
  }
}
