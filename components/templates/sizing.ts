import type { SizePreset } from '@/lib/db/schema';

// Per-template size lookups.
// LARGE = the original spec value. MEDIUM and SMALL are two steps smaller.
// Default is 'large' so existing slides + new slides without a chosen size
// render at the original/spec size.

// Logo: max 900px = 100% (close to the 1080px canvas minus 80px side padding,
// so 100% reads as "full-width" like the parish-name lockup in slide 1.jpg).
// Slider value (20-100) is a percentage of this.
export const PARISH_IDENTITY_LOGO_MAX_WIDTH_BASE = 900;

// Legacy string presets — backward compat for slides saved before the slider
const LOGO_PRESET_PCT: Record<SizePreset, number> = {
  small: 60,
  medium: 80,
  large: 100,
};

export function resolveLogoPercent(value: number | SizePreset | undefined): number {
  if (typeof value === 'number') {
    return Math.max(20, Math.min(100, value));
  }
  if (value && value in LOGO_PRESET_PCT) {
    return LOGO_PRESET_PCT[value as SizePreset];
  }
  return 100;
}

export function resolveLogoWidth(value: number | SizePreset | undefined): number {
  return PARISH_IDENTITY_LOGO_MAX_WIDTH_BASE * (resolveLogoPercent(value) / 100);
}

export const PARISH_IDENTITY_HEADLINE_SIZE: Record<SizePreset, number> = {
  small: 56,
  medium: 72,
  large: 96, // original
};

export const WELCOME_QUOTE_SIZE: Record<SizePreset, number> = {
  small: 64,
  medium: 80,
  large: 96, // original
};

export const GENERAL_HEADLINE_SIZE: Record<SizePreset, number> = {
  small: 88,
  medium: 112,
  large: 140, // original
};

export const APP_PROMO_HEADLINE_SIZE: Record<SizePreset, number> = {
  small: 88,
  medium: 112,
  large: 140, // original
};

export const SANCTUARY_CANDLE_NAME_SIZE: Record<SizePreset, number> = {
  small: 88,
  medium: 112,
  large: 140, // original
};

export function resolveSize<T extends Record<SizePreset, number>>(
  map: T,
  size: SizePreset | undefined,
): number {
  // Default to 'large' (original spec size) when no preset has been chosen.
  return map[size ?? 'large'];
}
