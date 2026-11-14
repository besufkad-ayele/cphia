import { NextResponse } from 'next/server';
import { getRegistrationOpen, registrationOpenEnvOverride } from '@/app/lib/registration-open';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public: whether /register accepts new applications. */
export async function GET() {
  const open = await getRegistrationOpen();
  const envOverride = registrationOpenEnvOverride();
  return NextResponse.json(
    {
      open,
      source: envOverride == null ? 'desk' : 'env',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
