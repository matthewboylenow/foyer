import { cache } from 'react';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tenants } from '@/lib/db/schema';
import { DISPLAY_CONTENT_TAG } from '@/lib/cacheTags';
import type { Tenant } from '@/lib/db/schema';

// Tenant rows change ~never, but this lookup runs on every request in the
// app (every API route + TenantTheme). Serving it from the Data Cache keeps
// steady-state traffic (display polls, admin tabs) off Postgres entirely so
// Neon compute can suspend. 5-minute revalidate + display-content tag.
const getTenantBySlugCached = unstable_cache(
  async (slug: string) =>
    db.query.tenants.findFirst({ where: eq(tenants.slug, slug) }),
  ['tenant-by-slug'],
  { revalidate: 300, tags: [DISPLAY_CONTENT_TAG] },
);

const getFirstTenantCached = unstable_cache(
  async () => db.query.tenants.findFirst(),
  ['tenant-first'],
  { revalidate: 300, tags: [DISPLAY_CONTENT_TAG] },
);

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
    const byHeader = await getTenantBySlugCached(slug);
    if (byHeader) return byHeader;
  }

  return getFirstTenantCached();
});
