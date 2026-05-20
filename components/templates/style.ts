import type { TextMode } from '@/lib/db/schema';

export interface Palette {
  /** Tailwind class for page background when no bg image is set. */
  pageBg: string;
  /** Tailwind class for the primary text color (headlines, body). */
  primary: string;
  /** Tailwind class for the accent color (rust ↔ gold). */
  accent: string;
  /** Tailwind class for thin rule lines (rust ↔ gold). */
  rule: string;
  /** CSS gradient string for the bg-image tint overlay. */
  bgImageTint: string;
  /** CSS gradient for the static warm ambient accent when no bg image. */
  ambient: string;
}

/**
 * Resolves the per-slide palette from a textMode choice.
 *
 * 'dark' = dark text on a light page (navy + rust on cream).
 * 'light' = light text on a dark page (cream + gold on navy-900).
 *
 * Templates pass the user's selection (or their own per-template default)
 * and read color classes off the returned object. Keeps each template's
 * markup branch-free.
 */
export function palette(mode: TextMode): Palette {
  if (mode === 'light') {
    return {
      pageBg: 'bg-navy-900',
      primary: 'text-cream',
      accent: 'text-gold',
      rule: 'bg-gold',
      bgImageTint:
        'linear-gradient(180deg, rgba(11,19,42,0.6) 0%, rgba(11,19,42,0.42) 50%, rgba(11,19,42,0.78) 100%)',
      ambient:
        'radial-gradient(ellipse at 50% 70%, rgba(212,175,55,0.07) 0%, transparent 62%)',
    };
  }
  return {
    pageBg: 'bg-cream',
    primary: 'text-navy',
    accent: 'text-rust',
    rule: 'bg-rust',
    bgImageTint:
      'linear-gradient(180deg, rgba(250,249,247,0.78) 0%, rgba(250,249,247,0.55) 50%, rgba(250,249,247,0.85) 100%)',
    ambient:
      'radial-gradient(ellipse at 50% 72%, rgba(205,83,52,0.07) 0%, transparent 62%)',
  };
}
