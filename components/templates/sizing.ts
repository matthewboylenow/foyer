import type { SizePreset } from '@/lib/db/schema';

// Per-template size lookups.
// LARGE = the original spec value. MEDIUM and SMALL are two steps smaller.
// Default is 'large' so existing slides + new slides without a chosen size
// render at the original/spec size.

export const PARISH_IDENTITY_LOGO_MAX_WIDTH: Record<SizePreset, number> = {
  small: 280,
  medium: 380,
  large: 480, // original
};

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
