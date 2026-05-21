'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Client-side context for the current tenant. Provided by server layouts
 * that have already resolved the tenant (via `getCurrentTenant()`); read
 * by client components that need the slug — uploads, especially, prefix
 * blob paths with it for tenant-scoped storage.
 */
const TenantSlugContext = createContext<string | null>(null);

export function TenantSlugProvider({
  slug,
  children,
}: {
  slug: string | null;
  children: ReactNode;
}) {
  return <TenantSlugContext.Provider value={slug}>{children}</TenantSlugContext.Provider>;
}

/**
 * Returns the current tenant's slug, or null if it isn't available (e.g.
 * on routes outside the admin tree). Components that depend on a slug
 * should fall back gracefully — for uploads, omitting the prefix.
 */
export function useTenantSlug(): string | null {
  return useContext(TenantSlugContext);
}
