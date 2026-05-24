/**
 * WCAG contrast-ratio helpers, scoped to what the palette editor needs.
 *
 * The slide templates put cream text on navy, navy text on cream, and
 * cream text on rust (buttons / accent surfaces). Each of those pairs is
 * a function of the palette the user picks, so the editor checks them
 * live and flags the ones below 4.5:1 — the WCAG AA bar for normal text,
 * which is the right floor even for large display headlines because
 * "across the lobby" works the eyes harder than "12 inches from a laptop."
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const v = m[1];
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

/** sRGB → linear, per WCAG 2.x relative luminance definition. */
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foregroundHex: string, backgroundHex: string): number | null {
  const fg = relativeLuminance(foregroundHex);
  const bg = relativeLuminance(backgroundHex);
  if (fg == null || bg == null) return null;
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastVerdict = 'good' | 'borderline' | 'fail';

/** WCAG AA threshold for normal-size text. Slides use display sizes
 *  (≥48px) which technically qualify for the 3:1 large-text floor, but
 *  TV-from-30-feet eats two stops of contrast on its own, so we hold
 *  the 4.5:1 line. 7:1 is AAA — overkill for headlines. */
export const MIN_CONTRAST_RATIO = 4.5;
export const BORDERLINE_CONTRAST_RATIO = 6;

export function verdict(ratio: number | null): ContrastVerdict {
  if (ratio == null) return 'fail';
  if (ratio < MIN_CONTRAST_RATIO) return 'fail';
  if (ratio < BORDERLINE_CONTRAST_RATIO) return 'borderline';
  return 'good';
}

export interface ContrastCheck {
  /** Human-readable label, e.g. "Cream text on Navy". */
  label: string;
  /** Where this combination shows up (helps the user understand the warning). */
  where: string;
  foreground: string;
  background: string;
  ratio: number | null;
  verdict: ContrastVerdict;
}

/**
 * The three pairings that actually drive slide legibility. We do NOT
 * check every theoretical combination — that creates warning noise the
 * user can't act on (they're not going to fix gold-on-cream if no
 * template ever uses it).
 */
export function paletteContrastChecks(palette: {
  primaryColor: string;
  accentColor: string;
  creamColor: string;
  goldColor: string;
}): ContrastCheck[] {
  const items: Omit<ContrastCheck, 'ratio' | 'verdict'>[] = [
    {
      label: 'Cream text on Navy',
      where: 'Light-on-dark slide templates (Sanctuary Candle, AppPromo, Parish Identity)',
      foreground: palette.creamColor,
      background: palette.primaryColor,
    },
    {
      label: 'Navy text on Cream',
      where: 'Dark-on-light slide templates (Welcome Quote, General, Mass Schedule)',
      foreground: palette.primaryColor,
      background: palette.creamColor,
    },
    {
      label: 'Cream text on Rust',
      where: 'Buttons, accent labels, action UI',
      foreground: palette.creamColor,
      background: palette.accentColor,
    },
  ];
  return items.map((i) => {
    const ratio = contrastRatio(i.foreground, i.background);
    return { ...i, ratio, verdict: verdict(ratio) };
  });
}
