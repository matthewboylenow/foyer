import { auth } from '@/lib/auth/config';
import type { NextRequest } from 'next/server';

export default auth((req: NextRequest & { auth: unknown }) => {
  const { pathname } = req.nextUrl;

  // Dev bypass: AUTH_DEV_BYPASS=1 skips auth checks
  if (process.env.AUTH_DEV_BYPASS === '1') return;

  const isAdminRoute = pathname.startsWith('/admin');
  const isProtectedApi =
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/display') &&
    !pathname.startsWith('/api/auth') &&
    !pathname.startsWith('/api/otp');

  if ((isAdminRoute || isProtectedApi) && !(req as { auth: unknown }).auth) {
    const url = new URL('/login', req.url);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};
