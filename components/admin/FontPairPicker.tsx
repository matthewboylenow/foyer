'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { FONT_PAIRS, getFontPair, googleFontsUrlForPair } from '@/lib/fonts';

interface FontPairPickerProps {
  /** Current tenant's font_pair id from settings. */
  initial: string;
}

export function FontPairPicker({ initial }: FontPairPickerProps) {
  const [pairId, setPairId] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(initial);
  const dirty = pairId !== savedId;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fontPair: pairId }),
      });
      if (!res.ok) throw new Error('Failed');
      setSavedId(pairId);
      toast.success('Font pair saved', {
        description: 'Refresh any open TV displays to see it.',
      });
    } catch {
      toast.error("Couldn't save font pair");
    } finally {
      setSaving(false);
    }
  }

  // Inject Google Fonts <link> tags for every pair so the previews
  // render in the real fonts. We only load these on the settings page so
  // the cost is bounded.
  const allUrls = FONT_PAIRS.map((p) => googleFontsUrlForPair(p));

  return (
    <div className="space-y-4">
      {allUrls.map((url) => (
        // eslint-disable-next-line @next/next/no-css-tags
        <link key={url} rel="stylesheet" href={url} />
      ))}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FONT_PAIRS.map((p) => {
          const active = p.id === pairId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPairId(p.id)}
              className={`group text-left rounded-lg border p-4 transition-all ${
                active
                  ? 'border-rust bg-rust/5 ring-2 ring-rust/20'
                  : 'border-navy/15 hover:border-navy/40 bg-cream'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="text-sm font-medium text-navy">{p.label}</div>
                  <div className="text-[11px] text-navy/55 mt-0.5 leading-snug">
                    {p.description}
                  </div>
                </div>
                {active && (
                  <span className="shrink-0 size-5 rounded-full bg-rust text-cream grid place-items-center">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </div>

              {/* Sample preview — heading face + body face. Uses inline
                  style with the exact families so it isn't affected by
                  whichever pair the surrounding TenantTheme is using. */}
              <div className="space-y-1.5 mt-2 pt-3 border-t border-navy/10">
                <div
                  className="text-[28px] leading-tight text-navy"
                  style={{ fontFamily: `"${p.headingFamily}", ${p.headingFallback}`, fontWeight: 700 }}
                >
                  Welcome, friend.
                </div>
                <div
                  className="text-[13px] leading-snug text-navy/70"
                  style={{ fontFamily: `"${p.bodyFamily}", ${p.bodyFallback}`, fontWeight: 400 }}
                >
                  Masses at 7:30, 9:00, and 11:00 every Sunday.
                </div>
                <div className="text-[10px] uppercase tracking-widest text-navy/40 pt-1 font-mono">
                  {p.headingFamily} · {p.bodyFamily}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        {dirty && (
          <p className="text-xs text-navy/55 mr-auto">
            Selecting <strong className="font-medium text-navy">{getFontPair(pairId).label}</strong> —
            click save to apply.
          </p>
        )}
        <Button
          onClick={save}
          disabled={!dirty || saving}
          className="bg-rust text-cream hover:bg-rust-700"
        >
          {saving ? 'Saving…' : 'Save font pair'}
        </Button>
      </div>
    </div>
  );
}
