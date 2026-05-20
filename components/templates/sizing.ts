import type { SizePreset } from '@/lib/db/schema';

// Per-template size lookups. Each template has its own visual baseline.

export const PARISH_IDENTITY_LOGO_MAX_WIDTH: Record<SizePreset, number> = {
  small: 320,
  medium: 480,
  large: 640,
};

export const PARISH_IDENTITY_HEADLINE_SIZE: Record<SizePreset, number> = {
  small: 64,
  medium: 96,
  large: 140,
};

export const WELCOME_QUOTE_SIZE: Record<SizePreset, number> = {
  small: 72,
  medium: 96,
  large: 140,
};

export const GENERAL_HEADLINE_SIZE: Record<SizePreset, number> = {
  small: 96,
  medium: 140,
  large: 200,
};

export const APP_PROMO_HEADLINE_SIZE: Record<SizePreset, number> = {
  small: 96,
  medium: 140,
  large: 200,
};

export const SANCTUARY_CANDLE_NAME_SIZE: Record<SizePreset, number> = {
  small: 96,
  medium: 140,
  large: 200,
};

export function resolveSize<T extends Record<SizePreset, number>>(
  map: T,
  size: SizePreset | undefined,
): number {
  return map[size ?? 'medium'];
}
