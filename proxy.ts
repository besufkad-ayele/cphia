import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifyAdminJwt } from '@/app/lib/admin/session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login' || pathname === '/api/admin/login' || pathname === '/api/admin/logout') {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const session = await verifyAdminJwt(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
    if (!session) {
      if (pathname.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}
