'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'choose' | 'email' | 'code';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('choose');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to send code');
      } else {
        setStep('code');
        setResendCooldown(true);
        setTimeout(() => setResendCooldown(false), 30_000);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('email-otp', {
      email,
      code,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid or expired code. Please try again.');
    } else {
      window.location.href = '/admin/slides';
    }
  }

  async function handleResend() {
    await fetch('/api/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setResendCooldown(true);
    setTimeout(() => setResendCooldown(false), 30_000);
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-sm border border-navy-100 p-8">
        {/* Logo area */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif text-navy font-bold">Foyer</h1>
          <p className="text-sm text-muted-foreground mt-1">Saint Helen Parish Signage</p>
        </div>

        {step === 'choose' && (
          <div className="space-y-3">
            <Button
              className="w-full bg-navy hover:bg-navy-700 text-cream"
              onClick={() => signIn('microsoft-entra-id', { callbackUrl: '/admin/slides' })}
            >
              Sign in with Microsoft
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest text-muted-foreground">
                <span className="bg-white px-2">or</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full border-navy text-navy"
              onClick={() => setStep('email')}
            >
              Sign in with email
            </Button>
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@sainthelen.org"
                required
              />
            </div>
            {error && <p className="text-sm text-rust">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-rust hover:bg-rust-700 text-cream"
              disabled={loading}
            >
              {loading ? 'Sending…' : 'Send code'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-navy underline"
              onClick={() => setStep('choose')}
            >
              Back
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A 6-digit code was sent to <strong>{email}</strong>.
            </p>
            <div className="space-y-1">
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                required
              />
            </div>
            {error && <p className="text-sm text-rust">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-rust hover:bg-rust-700 text-cream"
              disabled={loading}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {resendCooldown ? (
                <span>Resend code available in 30s</span>
              ) : (
                <button
                  type="button"
                  className="underline hover:text-navy"
                  onClick={handleResend}
                >
                  Resend code
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
