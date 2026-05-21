import { auth } from '@/lib/auth/config';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Combined auth + tenant-resolution middleware.
 *
 * 1. **Tenant resolution** — every request gets an `x-tenant-slug` header
 *    derived from the host subdomain (e.g. `sthelen.getfoyer.com`
 *    → "sthelen"). Downstream server code reads it via
 *    `lib/tenant.ts:getCurrentTenant()`. Apex / www / localhost don't
 *    produce a slug; `getCurrentTenant()` falls back to the first tenant.
 *
 * 2. **Auth gate** — unauthenticated requests to /admin/* or protected
 *    API routes are redirected to /login. Display + auth + OTP routes are
 *    public. `AUTH_DEV_BYPASS=1` skips this entirely.
 */
export default auth((req: NextRequest & { auth: unknown }) => {
  const requestHeaders = new Headers(req.headers);
  const host = req.headers.get('host') ?? '';
  const slug = extractSubdomain(host);
  if (slug) requestHeaders.set('x-tenant-slug', slug);
  else requestHeaders.delete('x-tenant-slug');

  const { pathname } = req.nextUrl;
  if (process.env.AUTH_DEV_BYPASS !== '1') {
    const isAdminRoute = pathname.startsWith('/admin') || pathname.startsWith('/super');
    const isProtectedApi =
      pathname.startsWith('/api/') &&
      !pathname.startsWith('/api/display') &&
      !pathname.startsWith('/api/auth') &&
      !pathname.startsWith('/api/otp');

    if ((isAdminRoute || isProtectedApi) && !(req as { auth: unknown }).auth) {
      const url = new URL('/login', req.url);
      return Response.redirect(url);
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
});

function extractSubdomain(host: string): string | null {
  const bare = host.split(':')[0].toLowerCase();
  if (
    bare === 'localhost' ||
    bare.endsWith('.localhost') ||
    bare === '127.0.0.1' ||
    bare === '0.0.0.0'
  ) {
    return null;
  }
  const parts = bare.split('.');
  if (parts.length < 3) return null;
  const sub = parts[0];
  if (sub === 'www' || sub === 'app' || sub === 'api' || sub === 'marketing') {
    return null;
  }
  return sub;
}

export const config = {
  // Run on every page + API route except static assets. Broader than the
  // previous matcher because tenant resolution needs to happen for
  // /display/[id] (player) and the marketing apex too.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)).*)',
  ],
};
