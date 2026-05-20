import { signIn } from '@/lib/auth/config';

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return Response.json({ error: 'Email and code are required' }, { status: 400 });
    }

    // Auth.js Credentials provider handles the actual verify + session creation
    // The client calls signIn('email-otp') directly; this route is just for validation feedback
    void email; void code;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
