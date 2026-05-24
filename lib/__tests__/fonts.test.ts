import { describe, it, expect } from 'vitest';
import {
  FONT_PAIRS,
  DEFAULT_PAIR_ID,
  getFontPair,
  googleFontsUrlForPair,
  fontStackForPair,
} from '../fonts';

describe('FONT_PAIRS', () => {
  it('exposes a set of pairs', () => {
    expect(FONT_PAIRS.length).toBeGreaterThanOrEqual(4);
  });
  it('has unique stable ids', () => {
    const ids = FONT_PAIRS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('the default pair id exists in the list', () => {
    expect(FONT_PAIRS.some((p) => p.id === DEFAULT_PAIR_ID)).toBe(true);
  });
  it("Saint Helen's editorial-serif is still in the list (backward compat)", () => {
    expect(FONT_PAIRS.some((p) => p.id === 'editorial-serif')).toBe(true);
  });
});

describe('getFontPair', () => {
  it('returns the matching pair by id', () => {
    expect(getFontPair('editorial-serif').headingFamily).toBe('Libre Baskerville');
  });
  it('falls back to the first pair on unknown id', () => {
    expect(getFontPair('whatever').id).toBe(FONT_PAIRS[0].id);
  });
  it('falls back on null/undefined', () => {
    expect(getFontPair(null).id).toBe(FONT_PAIRS[0].id);
    expect(getFontPair(undefined).id).toBe(FONT_PAIRS[0].id);
  });
});

describe('googleFontsUrlForPair', () => {
  it('builds a CSS2 URL with both families and display=swap', () => {
    const url = googleFontsUrlForPair(getFontPair('editorial-serif'));
    expect(url).toContain('fonts.googleapis.com/css2');
    expect(url).toContain('Libre+Baskerville');
    expect(url).toContain('Libre+Franklin');
    expect(url).toContain('display=swap');
  });
  it('handles single-word family names', () => {
    const url = googleFontsUrlForPair(getFontPair('classic-sans'));
    expect(url).toContain('family=Lora');
    expect(url).toContain('Open+Sans');
  });
});

describe('fontStackForPair', () => {
  it('wraps family names in quotes and appends a fallback', () => {
    const { headingStack, bodyStack } = fontStackForPair(getFontPair('editorial-serif'));
    expect(headingStack).toMatch(/^"Libre Baskerville",/);
    expect(bodyStack).toMatch(/^"Libre Franklin",/);
  });
});
