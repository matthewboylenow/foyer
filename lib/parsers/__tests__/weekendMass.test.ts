import { describe, it, expect } from 'vitest';
import { parseWeekendMass } from '../weekendMass';

describe('parseWeekendMass', () => {
  it('parses standard format with hyphen separator', () => {
    const result = parseWeekendMass('5:00 PM - John Smith');
    expect(result.rows).toEqual([{ timeLabel: '5:00 PM', intention: 'John Smith', needsReview: false }]);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles en dash separator', () => {
    const result = parseWeekendMass('5:00 PM – John Smith');
    expect(result.rows[0]).toMatchObject({ timeLabel: '5:00 PM', intention: 'John Smith' });
    expect(result.warnings).toHaveLength(0);
  });

  it('handles em dash separator', () => {
    const result = parseWeekendMass('10:30 AM — Anniversary of the Doe Family');
    expect(result.rows[0]).toMatchObject({ timeLabel: '10:30 AM', intention: 'Anniversary of the Doe Family' });
  });

  it('normalizes lowercase am/pm', () => {
    const result = parseWeekendMass('5:00 pm - John');
    expect(result.rows[0].timeLabel).toBe('5:00 PM');
  });

  it('normalizes mixed case am/pm', () => {
    const result = parseWeekendMass('7:00 Am - Mary');
    expect(result.rows[0].timeLabel).toBe('7:00 AM');
  });

  it('parses multiple rows', () => {
    const input = `5:00 PM - John Smith
7:00 AM - Mary Brown
9:00 AM - Peter Johnson
10:30 AM - The Doe Family
12:00 PM - For the People of the Parish`;
    const result = parseWeekendMass(input);
    expect(result.rows).toHaveLength(5);
    expect(result.warnings).toHaveLength(0);
    expect(result.rows[2]).toMatchObject({ timeLabel: '9:00 AM', intention: 'Peter Johnson', needsReview: false });
  });

  it('flags unparseable lines as needsReview', () => {
    const result = parseWeekendMass('Something weird without a time');
    expect(result.rows[0].needsReview).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].lineNumber).toBe(1);
  });

  it('handles mixed parseable and unparseable lines', () => {
    const input = `5:00 PM - John Smith
Something weird
9:00 AM - Mary`;
    const result = parseWeekendMass(input);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].needsReview).toBe(false);
    expect(result.rows[1].needsReview).toBe(true);
    expect(result.rows[2].needsReview).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });

  it('handles 12-hour time including 12:00', () => {
    const result = parseWeekendMass('12:00 PM - Noon Mass');
    expect(result.rows[0].timeLabel).toBe('12:00 PM');
    expect(result.rows[0].needsReview).toBe(false);
  });

  it('skips blank lines', () => {
    const result = parseWeekendMass('5:00 PM - John\n\n7:00 AM - Mary');
    expect(result.rows).toHaveLength(2);
  });

  it('handles tab separator', () => {
    const result = parseWeekendMass('5:00 PM\tJohn Smith');
    expect(result.rows[0]).toMatchObject({ timeLabel: '5:00 PM', intention: 'John Smith', needsReview: false });
  });

  it('returns empty rows for empty input', () => {
    const result = parseWeekendMass('');
    expect(result.rows).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('includes full intention text including commas', () => {
    const result = parseWeekendMass('5:00 PM - John Smith, requested by the Smith family');
    expect(result.rows[0].intention).toBe('John Smith, requested by the Smith family');
  });
});
