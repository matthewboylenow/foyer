import { isAllowedEmail } from '@/lib/auth/allowlist';
import { sendOtp } from '@/lib/auth/otp';

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!isAllowedEmail(email)) {
      // Return 200 with a generic message to avoid user enumeration
      return Response.json({ ok: true });
    }

    await sendOtp(email.toLowerCase().trim());
    return Response.json({ ok: true });
  } catch (err) {
    console.error('OTP send error:', err);
    return Response.json({ error: 'Failed to send code' }, { status: 500 });
  }
}
