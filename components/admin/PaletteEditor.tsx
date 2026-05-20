'use client';

import { useState, type CSSProperties } from 'react';
import { toast } from '@/lib/toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DEFAULTS = {
  primaryColor: '#1F346D',
  accentColor: '#CD5334',
  creamColor: '#FAF9F7',
  goldColor: '#D4AF37',
} as const;

interface Props {
  initial: {
    primaryColor: string;
    accentColor: string;
    creamColor: string;
    goldColor: string;
  };
}

const SWATCHES: { key: keyof typeof DEFAULTS; label: string; hint: string }[] = [
  { key: 'primaryColor', label: 'Primary (Navy)', hint: 'Headlines, dark backgrounds, nav sidebar' },
  { key: 'accentColor', label: 'Accent (Rust)', hint: 'Buttons, dated rules, schedule bars' },
  { key: 'creamColor', label: 'Surface (Cream)', hint: 'Page backgrounds, light slide surfaces' },
  { key: 'goldColor', label: 'Highlight (Gold)', hint: 'Hairline rules, glows, dividers' },
];

export function PaletteEditor({ initial }: Props) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  function update(key: keyof typeof DEFAULTS, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setValues(DEFAULTS);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Palette saved', {
        description: 'Refresh the player URL to see it on the TV.',
      });
    } catch {
      toast.error("Couldn't save palette");
    } finally {
      setSaving(false);
    }
  }

  // Live preview swatch row reflects current edits before save.
  const previewStyle = {
    '--preview-navy': values.primaryColor,
    '--preview-rust': values.accentColor,
    '--preview-cream': values.creamColor,
    '--preview-gold': values.goldColor,
  } as CSSProperties;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {SWATCHES.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center gap-4">
            <div className="flex items-center gap-3 shrink-0 w-44">
              <input
                type="color"
                value={values[key]}
                onChange={(e) => update(key, e.target.value)}
                className="size-9 rounded-md border border-navy/15 cursor-pointer"
                aria-label={label}
              />
              <Input
                value={values[key]}
                onChange={(e) => update(key, e.target.value)}
                className="font-mono text-xs w-24"
                spellCheck={false}
              />
            </div>
            <div className="min-w-0">
              <Label className="text-sm">{label}</Label>
              <p className="text-xs text-navy/55">{hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Live preview strip */}
      <div
        className="rounded-lg p-4 border border-navy/10"
        style={{ ...previewStyle, background: 'var(--preview-cream)' }}
      >
        <div className="text-[10px] uppercase tracking-widest text-navy/45 mb-3 font-medium">
          Live preview
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="px-3 py-2 rounded-md text-sm font-semibold"
            style={{ background: 'var(--preview-navy)', color: 'var(--preview-cream)' }}
          >
            Primary
          </div>
          <div
            className="px-3 py-2 rounded-md text-sm font-semibold"
            style={{ background: 'var(--preview-rust)', color: 'var(--preview-cream)' }}
          >
            Accent
          </div>
          <div
            className="px-3 py-2 rounded-md text-sm font-semibold"
            style={{ background: 'var(--preview-gold)', color: 'var(--preview-navy)' }}
          >
            Highlight
          </div>
          <div className="ml-auto inline-flex items-center gap-3">
            <Button variant="ghost" onClick={reset} className="text-navy/60 hover:text-navy">
              Reset to defaults
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              style={{ background: 'var(--preview-rust)' }}
              className="text-cream hover:brightness-110"
            >
              {saving ? 'Saving…' : 'Save palette'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
