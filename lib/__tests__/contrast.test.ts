import { describe, it, expect } from 'vitest';
import {
  contrastRatio,
  paletteContrastChecks,
  relativeLuminance,
  MIN_CONTRAST_RATIO,
  verdict,
} from '../contrast';

describe('relativeLuminance', () => {
  it('returns 1 for pure white and 0 for pure black', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 4);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 4);
  });
  it('accepts a hex without the leading #', () => {
    expect(relativeLuminance('ffffff')).toBeCloseTo(1, 4);
  });
  it('returns null for malformed input', () => {
    expect(relativeLuminance('not-a-color')).toBeNull();
    expect(relativeLuminance('#fff')).toBeNull(); // 3-char shorthand not supported
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });
  it('is 1 when fg and bg are identical', () => {
    expect(contrastRatio('#1F346D', '#1F346D')).toBeCloseTo(1, 4);
  });
  it('matches the WCAG-reported ratio for known cream-on-navy', () => {
    // Saint Helen's cream + navy. Hand-verified at WebAIM contrast checker.
    const r = contrastRatio('#FAF9F7', '#1F346D');
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(10);
  });
});

describe('verdict', () => {
  it('flags below-AA ratios as fail', () => {
    expect(verdict(3)).toBe('fail');
    expect(verdict(4.4)).toBe('fail');
  });
  it('treats 4.5–6 as borderline', () => {
    expect(verdict(4.5)).toBe('borderline');
    expect(verdict(5.5)).toBe('borderline');
  });
  it('treats 6+ as good', () => {
    expect(verdict(7)).toBe('good');
    expect(verdict(21)).toBe('good');
  });
  it('null ratios fail', () => {
    expect(verdict(null)).toBe('fail');
  });
});

describe('paletteContrastChecks', () => {
  it('returns three checks for a normal palette', () => {
    const checks = paletteContrastChecks({
      primaryColor: '#1F346D',
      accentColor: '#CD5334',
      creamColor: '#FAF9F7',
      goldColor: '#D4AF37',
    });
    expect(checks).toHaveLength(3);
    expect(checks.map((c) => c.label)).toEqual([
      'Cream text on Navy',
      'Navy text on Cream',
      'Cream text on Rust',
    ]);
  });
  it('Saint Helen palette passes the AA bar on navy/cream combos, flags rust as borderline-failing', () => {
    // Real surfaced finding: cream (#FAF9F7) on rust (#CD5334) ≈ 4.09:1,
    // just under the 4.5:1 AA bar. The editor warning that catches this
    // is exactly what we're shipping. Locking the assertion to current
    // reality so future palette tweaks don't silently regress.
    const checks = paletteContrastChecks({
      primaryColor: '#1F346D',
      accentColor: '#CD5334',
      creamColor: '#FAF9F7',
      goldColor: '#D4AF37',
    });
    const byLabel = Object.fromEntries(checks.map((c) => [c.label, c]));
    expect(byLabel['Cream text on Navy'].verdict).toBe('good');
    expect(byLabel['Navy text on Cream'].verdict).toBe('good');
    expect(byLabel['Cream text on Rust'].verdict).toBe('fail');
    expect(byLabel['Cream text on Rust'].ratio).toBeGreaterThan(3.5);
    expect(byLabel['Cream text on Rust'].ratio).toBeLessThan(MIN_CONTRAST_RATIO);
  });
  it('flags a pastel palette with low contrast as fail', () => {
    // Light blue "primary" on cream — visually pretty but barely readable.
    const checks = paletteContrastChecks({
      primaryColor: '#AABFE0',
      accentColor: '#E0AABF',
      creamColor: '#FAF9F7',
      goldColor: '#D4AF37',
    });
    const navyOnCream = checks.find((c) => c.label === 'Navy text on Cream')!;
    expect(navyOnCream.verdict).toBe('fail');
  });
});
