'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { parseEmailList } from '@/lib/monitoring';

interface Props {
  initial: {
    alertEmails: string | null;
    alertOfflineAfterMin: number;
  };
}

export function AlertSettingsEditor({ initial }: Props) {
  const [emails, setEmails] = useState(initial.alertEmails ?? '');
  const [minutes, setMinutes] = useState(String(initial.alertOfflineAfterMin));
  const [saving, setSaving] = useState(false);

  const recipients = parseEmailList(emails);

  async function save() {
    const n = parseInt(minutes, 10);
    if (!Number.isFinite(n) || n < 5) {
      toast.error('Wait at least 5 minutes before alerting');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertEmails: emails.trim() || null, alertOfflineAfterMin: n }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Alert settings saved');
    } catch {
      toast.error("Couldn't save alert settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-sm">Who to email</Label>
        <Textarea
          rows={2}
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          placeholder="communications@sainthelen.org, facilities@sainthelen.org"
        />
        <p className="text-xs text-navy/50">
          {recipients.length === 0
            ? 'No recipients — alerts are off.'
            : `${recipients.length} recipient${recipients.length === 1 ? '' : 's'}: ${recipients.join(', ')}`}
        </p>
      </div>
      <div className="space-y-1">
        <Label className="text-sm">Email after a screen has been silent for</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={5}
            max={1440}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-navy/60">minutes</span>
        </div>
        <p className="text-xs text-navy/50">
          One email when a screen goes down, one when it comes back. A TV that is simply
          turned off at night will trigger this too, so set the threshold with that in mind
          or deactivate the display in the evening.
        </p>
      </div>
      <Button onClick={save} disabled={saving} className="bg-navy text-cream">
        {saving ? 'Saving…' : 'Save alerts'}
      </Button>
    </div>
  );
}
