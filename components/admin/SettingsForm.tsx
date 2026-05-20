'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { Settings } from '@/lib/db/schema';

interface SettingsFormProps {
  settings: Settings;
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const [globalDuration, setGlobalDuration] = useState(String(settings.globalDurationSec));
  const [videoEnabled, setVideoEnabled] = useState(settings.videoEnabled);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          globalDurationSec: parseInt(globalDuration) || 15,
          videoEnabled,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Settings saved');
    } catch {
      toast.error("Couldn't save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Default slide duration (seconds)</Label>
        <Input
          type="number"
          min="5"
          max="120"
          value={globalDuration}
          onChange={(e) => setGlobalDuration(e.target.value)}
          className="w-32"
        />
        <p className="text-xs text-muted-foreground">
          Each template has its own default (General: 18s, Mass Schedule: 20s). This is the fallback.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={videoEnabled} onCheckedChange={setVideoEnabled} disabled />
        <Label className="text-muted-foreground">Video enabled (v1 — no video uploads yet)</Label>
      </div>

      <Button onClick={handleSave} disabled={saving} className="bg-navy text-cream">
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </div>
  );
}
