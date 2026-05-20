'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Props {
  initial: {
    emailFromName: string | null;
    emailFromAddress: string | null;
  };
  envFallback: string;
}

export function EmailFromEditor({ initial, envFallback }: Props) {
  const [name, setName] = useState(initial.emailFromName ?? '');
  const [address, setAddress] = useState(initial.emailFromAddress ?? '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      toast.error('Email address looks invalid');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailFromName: name.trim() || null,
          emailFromAddress: address.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Sender saved');
    } catch {
      toast.error("Couldn't save sender");
    } finally {
      setSaving(false);
    }
  }

  const preview = name && address
    ? `${name} <${address}>`
    : address || envFallback;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-sm">Display name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Saint Helen Signage"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-sm">Email address</Label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="no-reply@sainthelen.org"
            type="email"
            spellCheck={false}
          />
        </div>
      </div>
      <div className="rounded-md bg-navy/[0.03] border border-navy/10 px-3 py-2 text-xs">
        <div className="text-navy/45 uppercase tracking-widest font-medium mb-1 text-[10px]">
          Login emails will come from
        </div>
        <div className="font-mono text-navy/80">{preview}</div>
      </div>
      <p className="text-xs text-navy/55">
        Empty fields fall back to the <code className="font-mono">EMAIL_FROM</code> environment
        variable. The sending domain must be verified in Resend.
      </p>
      <Button
        onClick={save}
        disabled={saving}
        className="bg-rust hover:bg-rust-700 text-cream"
      >
        {saving ? 'Saving…' : 'Save sender'}
      </Button>
    </div>
  );
}
