import bcrypt from 'bcryptjs';
import { eq, and, isNull, gte, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { otpCodes } from '@/lib/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
import { getSettingsByTenant } from '@/lib/db/queries';

function getResend() {
  const { Resend } = require('resend') as typeof import('resend');
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  return new Resend(key);
}

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendOtp(email: string): Promise<void> {
  const code = generateSixDigitCode();
  const hash = await bcrypt.hash(code, 10);

  await db.insert(otpCodes).values({
    email,
    codeHash: hash,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  // Resolve the "from" address. Per-tenant override wins (configured in
  // /admin/settings); falls back to EMAIL_FROM env var; final fallback is
  // the original Saint Helen address so existing dev/prod keeps working.
  const tenant = await getCurrentTenant();
  const tenantSettings = tenant ? await getSettingsByTenant(tenant.id) : null;
  const tenantFromName = tenantSettings?.emailFromName?.trim();
  const tenantFromAddr = tenantSettings?.emailFromAddress?.trim();
  let from: string;
  if (tenantFromName && tenantFromAddr) {
    from = `${tenantFromName} <${tenantFromAddr}>`;
  } else if (tenantFromAddr) {
    from = tenantFromAddr;
  } else {
    const fromRaw =
      process.env.EMAIL_FROM ?? 'Saint Helen Signage <no-reply@sending.sainthelen.org>';
    from = fromRaw.trim().replace(/^["']|["']$/g, '');
  }
  const resend = getResend();

  await resend.emails.send({
    from,
    to: email,
    subject: `Your sign-in code: ${code}`,
    text: `Your sign-in code is ${code}. It expires in 10 minutes.\n\nIf you did not request this code, you can ignore this email.`,
  });
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const row = await db.query.otpCodes.findFirst({
    where: and(
      eq(otpCodes.email, email),
      isNull(otpCodes.consumedAt),
      gte(otpCodes.expiresAt, new Date()),
    ),
    orderBy: [desc(otpCodes.createdAt)],
  });

  if (!row) return { ok: false, error: 'No active code' };
  if (row.attempts >= 5) return { ok: false, error: 'Too many attempts' };

  const valid = await bcrypt.compare(code, row.codeHash);

  await db
    .update(otpCodes)
    .set({ attempts: row.attempts + 1, consumedAt: valid ? new Date() : null })
    .where(eq(otpCodes.id, row.id));

  if (!valid) return { ok: false, error: 'Invalid code' };
  return { ok: true };
}
