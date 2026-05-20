'use client';

import { Label } from '@/components/ui/label';
import { ImageUpload } from './ImageUpload';
import type { TextMode } from '@/lib/db/schema';

interface StyleSectionProps {
  /** Current bg image url for preview. */
  bgImageUrl: string | null;
  onBgImageUploaded: (id: string, blobUrl: string) => void;
  onBgImageCleared: () => void;
  /** Set on light-themed templates to enable the dark↔light text toggle. */
  textMode?: TextMode;
  defaultTextMode?: TextMode;
  onTextModeChange?: (mode: TextMode) => void;
}

/**
 * Shared "Style" block in the slide editor — bg image + optional text-mode
 * toggle. Light-themed templates (WelcomeQuote, General, MassSchedule,
 * WeeklyAssociation) pass the toggle props; dark-themed templates
 * (SanctuaryCandle, AppPromo, ParishIdentity) omit them.
 */
export function StyleSection({
  bgImageUrl,
  onBgImageUploaded,
  onBgImageCleared,
  textMode,
  defaultTextMode = 'dark',
  onTextModeChange,
}: StyleSectionProps) {
  const showToggle = Boolean(onTextModeChange);
  const current = textMode ?? defaultTextMode;

  return (
    <div className="pt-4 border-t border-border space-y-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Style</p>

      <ImageUpload
        label="Background image (optional)"
        type="image"
        currentUrl={bgImageUrl}
        onUploaded={({ id, blobUrl }) => onBgImageUploaded(id, blobUrl)}
        onCleared={onBgImageCleared}
      />

      {showToggle && (
        <div className="space-y-1">
          <Label className="text-xs">Text style</Label>
          <div className="inline-flex rounded-md border border-input overflow-hidden">
            {(['dark', 'light'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onTextModeChange?.(m)}
                className={`px-4 py-2 text-sm transition-colors ${
                  current === m
                    ? 'bg-rust text-cream'
                    : 'bg-background text-foreground hover:bg-muted'
                }`}
              >
                {m === 'dark' ? 'Dark on light' : 'Light on dark'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Pair light text with a darker background image for legibility.
          </p>
        </div>
      )}
    </div>
  );
}
