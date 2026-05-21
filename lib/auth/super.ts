/**
 * Super-admin allowlist — emails that can access /super (cross-tenant
 * operator views: errors, tenant health, etc).
 *
 * Configured via the SUPER_ADMIN_EMAILS env var as a comma-separated list.
 * Comparison is case-insensitive and trims whitespace.
 *
 * This is intentionally separate from the per-tenant tenant_users table:
 * a super-admin doesn't need to be a member of any tenant.
 */
function loadAllowlist(): Set<string> {
  const raw = process.env.SUPER_ADMIN_EMAILS ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return loadAllowlist().has(email.toLowerCase());
}
