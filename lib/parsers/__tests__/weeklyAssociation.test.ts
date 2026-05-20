import { describe, it, expect } from 'vitest';
import { parseWeeklyAssociation } from '../weeklyAssociation';

describe('parseWeeklyAssociation', () => {
  it('parses one name per line', () => {
    const result = parseWeeklyAssociation('John Smith\nMary Brown\nThe Johnson Family');
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({ name: 'John Smith', needsReview: false });
    expect(result.rows[1]).toEqual({ name: 'Mary Brown', needsReview: false });
    expect(result.rows[2]).toEqual({ name: 'The Johnson Family', needsReview: false });
    expect(result.warnings).toHaveLength(0);
  });

  it('handles names with special characters', () => {
    const input = "Peter and Anne O'Sullivan\nJames MacGowan, Sr.";
    const result = parseWeeklyAssociation(input);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe("Peter and Anne O'Sullivan");
  });

  it('trims whitespace from names', () => {
    const result = parseWeeklyAssociation('  John Smith  \n  Mary Brown  ');
    expect(result.rows[0].name).toBe('John Smith');
    expect(result.rows[1].name).toBe('Mary Brown');
  });

  it('filters blank lines', () => {
    const result = parseWeeklyAssociation('John Smith\n\nMary Brown\n');
    expect(result.rows).toHaveLength(2);
  });

  it('produces no warnings for 12 or fewer names', () => {
    const names = Array.from({ length: 12 }, (_, i) => `Name ${i + 1}`).join('\n');
    const result = parseWeeklyAssociation(names);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns for more than 12 names', () => {
    const names = Array.from({ length: 13 }, (_, i) => `Name ${i + 1}`).join('\n');
    const result = parseWeeklyAssociation(names);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toContain('13 names');
  });

  it('returns empty rows for empty input', () => {
    const result = parseWeeklyAssociation('');
    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles the typical bulletin paste pattern', () => {
    const input = `John Smith
Mary Brown
The Johnson Family
Peter and Anne O'Sullivan
James MacGowan, Sr.
Margaret Williams
The Doe family, deceased
Robert Black
Catherine Black`;
    const result = parseWeeklyAssociation(input);
    expect(result.rows).toHaveLength(9);
    expect(result.warnings).toHaveLength(0);
  });
});
