import { cache } from 'react';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tenants } from '@/lib/db/schema';
import type { Tenant } from '@/lib/db/schema';

/**
 * Resolves the tenant for the current request.
 *
 * Lookup order:
 *   1. The `x-tenant-slug` header (set by `middleware.ts` from the request's
 *      subdomain — e.g. `sthelen.getfoyer.com` → `sthelen`).
 *   2. Fall back to `db.query.tenants.findFirst()` so localhost development
 *      and single-tenant deploys keep working without any subdomain plumbing.
 *
 * Wrapped in React's `cache()` so multiple calls within one request don't
 * re-query the DB.
 *
 * Must be called from a request-bound context (server component, route
 * handler, server action). For non-request contexts (cron jobs, scripts)
 * use `db.query.tenants.findFirst()` directly with a deliberate slug.
 */
export const getCurrentTenant = cache(async (): Promise<Tenant | undefined> => {
  let slug: string | null = null;
  try {
    const h = await headers();
    slug = h.get('x-tenant-slug');
  } catch {
    // `headers()` throws outside a request context — fall through to the
    // findFirst fallback so seed scripts / tests still work.
  }

  if (slug) {
    const byHeader = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });
    if (byHeader) return byHeader;
  }

  return db.query.tenants.findFirst();
});
