import { describe, it, expect } from 'vitest';
import { parseWeekdayMass } from '../weekdayMass';

describe('parseWeekdayMass', () => {
  it('parses abbreviated weekday with date', () => {
    const result = parseWeekdayMass('Mon 1/5 - Repose of John Smith');
    expect(result.rows[0]).toMatchObject({ timeLabel: 'Mon 1/5', intention: 'Repose of John Smith', needsReview: false });
    expect(result.warnings).toHaveLength(0);
  });

  it('parses all standard abbreviated weekdays', () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (const day of days) {
      const result = parseWeekdayMass(`${day} 1/5 - John Smith`);
      expect(result.rows[0].needsReview).toBe(false);
    }
  });

  it('parses full weekday names', () => {
    const result = parseWeekdayMass('Monday 1/5 - Mary Brown');
    expect(result.rows[0]).toMatchObject({ timeLabel: 'Monday 1/5', intention: 'Mary Brown', needsReview: false });
  });

  it('handles en dash separator', () => {
    const result = parseWeekdayMass('Tue 1/6 – Mary Brown');
    expect(result.rows[0]).toMatchObject({ timeLabel: 'Tue 1/6', intention: 'Mary Brown' });
  });

  it('parses a full week', () => {
    const input = `Mon 1/5 - Repose of John Smith
Tue 1/6 - Mary Brown
Wed 1/7 - Special intention
Thu 1/8 - The Walsh family
Fri 1/9 - In thanksgiving
Sat 1/10 - Anniversary of Joseph Long`;
    const result = parseWeekdayMass(input);
    expect(result.rows).toHaveLength(6);
    expect(result.warnings).toHaveLength(0);
    expect(result.rows.every((r) => !r.needsReview)).toBe(true);
  });

  it('flags date-only lines as needing review', () => {
    const result = parseWeekdayMass('1/5 - John Smith');
    expect(result.rows[0].needsReview).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].reason).toContain('weekday');
  });

  it('flags completely unparseable lines', () => {
    const result = parseWeekdayMass('Some random text without a date');
    expect(result.rows[0].needsReview).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it('is case-insensitive for weekday names', () => {
    const result = parseWeekdayMass('MON 1/5 - John');
    expect(result.rows[0].needsReview).toBe(false);
  });

  it('accepts abbreviated month + day (e.g. "May 18")', () => {
    const result = parseWeekdayMass('May 18 - Marchitelli Family & Jessica Lutkenhouse');
    expect(result.rows[0]).toMatchObject({
      timeLabel: 'May 18',
      intention: 'Marchitelli Family & Jessica Lutkenhouse',
      needsReview: false,
    });
    expect(result.warnings).toHaveLength(0);
  });

  it('accepts a full week of month + day rows', () => {
    const input = `May 18 - Marchitelli Family & Jessica Lutkenhouse
May 19 - McGettigan Family (Deceased Members)
May 20 - Frank Bernhard
May 21 - Nicholas Salerno
May 22 - Terry Vinanskie
May 23 - People of the Parish`;
    const result = parseWeekdayMass(input);
    expect(result.rows).toHaveLength(6);
    expect(result.warnings).toHaveLength(0);
    expect(result.rows.every((r) => !r.needsReview)).toBe(true);
  });

  it('accepts full month names (e.g. "January 5")', () => {
    const result = parseWeekdayMass('January 5 - Repose of John Smith');
    expect(result.rows[0]).toMatchObject({
      timeLabel: 'January 5',
      intention: 'Repose of John Smith',
      needsReview: false,
    });
  });

  it('accepts month names case-insensitively', () => {
    const result = parseWeekdayMass('JUN 12 - Anniversary');
    expect(result.rows[0].needsReview).toBe(false);
  });
});
