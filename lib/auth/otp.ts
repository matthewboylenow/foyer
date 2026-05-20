import bcrypt from 'bcryptjs';
import { eq, and, isNull, gte, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { otpCodes } from '@/lib/db/schema';

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

  // Strip surrounding quotes if env var was set with literal quotes (common in dashboards)
  const fromRaw = process.env.EMAIL_FROM ?? 'Saint Helen Signage <no-reply@sending.sainthelen.org>';
  const from = fromRaw.trim().replace(/^["']|["']$/g, '');
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
