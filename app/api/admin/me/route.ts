import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { unauthorized, verifyAdminSession } from '@/app/lib/admin/session';

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession(request);
  if (!session) return unauthorized();
  return NextResponse.json(session);
}
