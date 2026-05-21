import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { tenantUsers, settings } from '@/lib/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
/**
 * Tenant-aware allowlist.
 *
 * An email may sign in if EITHER:
 *   - it appears in `tenant_users` for the (current) tenant, OR
 *   - its domain matches `settings.allowed_domain` for the tenant.
 *
 * This replaces the v1.0 hardcoded list. The v1.7 migration seeds
 * matthew@adventii.com + 'sainthelen.org' into the default tenant so
 * existing logins keep working.
 */
export async function isAllowedEmail(email: string): Promise<boolean> {
  const e = email.toLowerCase().trim();
  if (!e) return false;
  const domain = e.split('@')[1];
  if (!domain) return false;

  const tenant = await getCurrentTenant();
  if (!tenant) return false;

  // Domain match — wildcard for everyone at a staff domain.
  const tenantSettings = await db.query.settings.findFirst({
    where: eq(settings.tenantId, tenant.id),
  });
  if (
    tenantSettings?.allowedDomain &&
    tenantSettings.allowedDomain.toLowerCase() === domain
  ) {
    return true;
  }

  // Explicit invite.
  const member = await db.query.tenantUsers.findFirst({
    where: and(eq(tenantUsers.tenantId, tenant.id), eq(tenantUsers.email, e)),
  });
  return Boolean(member);
}

export async function getTenantUserRole(
  email: string,
): Promise<'owner' | 'editor' | null> {
  const tenant = await getCurrentTenant();
  if (!tenant) return null;
  const e = email.toLowerCase().trim();
  const member = await db.query.tenantUsers.findFirst({
    where: and(eq(tenantUsers.tenantId, tenant.id), eq(tenantUsers.email, e)),
  });
  if (!member) return null;
  return member.role === 'owner' ? 'owner' : 'editor';
}
