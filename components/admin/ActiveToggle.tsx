'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ActiveToggleProps {
  slideId: string;
  initialActive: boolean;
  onToggle?: (active: boolean) => void;
}

export function ActiveToggle({ slideId, initialActive, onToggle }: ActiveToggleProps) {
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState(false);

  async function handleChange(checked: boolean) {
    setPending(true);
    const prev = active;
    setActive(checked);

    try {
      const res = await fetch(`/api/slides/${slideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: checked }),
      });
      if (!res.ok) throw new Error('Failed');
      onToggle?.(checked);
      toast.success(checked ? 'Slide activated' : 'Slide deactivated');
    } catch {
      setActive(prev);
      toast.error("Couldn't update slide");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Switch checked={active} onCheckedChange={handleChange} disabled={pending} />
      <Label className="cursor-pointer select-none">
        {active ? 'On — showing on TVs' : 'Off — hidden from TVs'}
      </Label>
    </div>
  );
}
