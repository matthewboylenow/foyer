import type { Settings } from '@/lib/db/schema';

/**
 * Shared Resend plumbing. `require` is deliberate (not a static import):
 * lib/auth/config.ts is pulled into the Edge middleware bundle via
 * lib/auth/otp.ts, and the Resend SDK is Node-only. Keeping the import
 * lazy means only the route that actually sends mail loads it.
 */
export function getResend() {
  const { Resend } = require('resend') as typeof import('resend');
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return new Resend(key);
}

/**
 * Resolve the "from" header. Per-tenant override wins (configured in
 * /admin/settings); falls back to EMAIL_FROM env var; final fallback is
 * the original Saint Helen address so existing dev/prod keeps working.
 */
export function resolveFromAddress(
  tenantSettings: Pick<Settings, 'emailFromName' | 'emailFromAddress'> | null | undefined,
): string {
  const name = tenantSettings?.emailFromName?.trim();
  const addr = tenantSettings?.emailFromAddress?.trim();
  if (name && addr) return `${name} <${addr}>`;
  if (addr) return addr;
  const fromRaw =
    process.env.EMAIL_FROM ?? 'Saint Helen Signage <no-reply@sending.sainthelen.org>';
  return fromRaw.trim().replace(/^["']|["']$/g, '');
}
