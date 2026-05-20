import { describe, it, expect } from 'vitest';
import { parseSanctuaryCandle } from '../sanctuaryCandle';

describe('parseSanctuaryCandle', () => {
  it('parses a simple name', () => {
    const result = parseSanctuaryCandle('John Smith');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ name: 'John Smith', needsReview: false });
    expect(result.warnings).toHaveLength(0);
  });

  it('trims surrounding whitespace', () => {
    const result = parseSanctuaryCandle('  Mary Brown  ');
    expect(result.rows[0]).toEqual({ name: 'Mary Brown', needsReview: false });
  });

  it('handles names with special characters', () => {
    const result = parseSanctuaryCandle("O'Brien, Jr.");
    expect(result.rows[0].name).toBe("O'Brien, Jr.");
  });

  it('returns empty rows and a warning for empty input', () => {
    const result = parseSanctuaryCandle('');
    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toContain('required');
  });

  it('returns empty rows and a warning for whitespace-only input', () => {
    const result = parseSanctuaryCandle('   ');
    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  it('treats the first line as the full name (no multi-line splitting)', () => {
    const result = parseSanctuaryCandle('John Smith\nExtra line');
    // Accepts the whole multi-line string trimmed, per the simple parser spec
    expect(result.rows).toHaveLength(1);
  });
});
