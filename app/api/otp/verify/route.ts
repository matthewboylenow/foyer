export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return Response.json({ error: 'Email and code are required' }, { status: 400 });
    }
    // Auth.js Credentials provider handles the actual verify + session creation via signIn('email-otp').
    // This route is available for server-side validation if needed in future.
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Verification failed' }, { status: 500 });
  }
}
