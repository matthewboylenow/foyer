'use client';

import { Label } from '@/components/ui/label';
import type { SizePreset } from '@/lib/db/schema';

const SIZES: SizePreset[] = ['small', 'medium', 'large'];

interface SizeButtonsProps {
  label: string;
  value: SizePreset | undefined;
  onChange: (v: SizePreset) => void;
}

export function SizeButtons({ label, value, onChange }: SizeButtonsProps) {
  const current = value ?? 'medium';
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="inline-flex border border-border rounded-md overflow-hidden">
        {SIZES.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`px-3 py-1.5 text-sm capitalize transition-colors ${
              current === s
                ? 'bg-navy text-cream'
                : 'bg-background text-muted-foreground hover:bg-muted'
            } ${i > 0 ? 'border-l border-border' : ''}`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
