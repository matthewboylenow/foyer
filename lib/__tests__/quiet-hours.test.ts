import { describe, it, expect } from 'vitest';
import { isQuietHour, offlineAfterSec, parseQuietHours, playerStatus, OFFLINE_AFTER_SEC, QUIET_OFFLINE_AFTER_SEC } from '../monitoring';

// 2026-11-23 03:30 Eastern (EST, UTC-5) and 14:30 Eastern.
const night = new Date('2026-11-23T08:30:00Z');
const day = new Date('2026-11-23T19:30:00Z');

describe('quiet hours', () => {
  it('defaults to 23:00 to 06:00 Eastern', () => {
    const q = parseQuietHours(undefined)!;
    expect(q).toMatchObject({ from: 23, to: 6, tz: 'America/New_York' });
    expect(isQuietHour(night, q)).toBe(true);
    expect(isQuietHour(day, q)).toBe(false);
  });

  it('accepts a custom window and rejects nonsense', () => {
    expect(parseQuietHours('22-7')).toMatchObject({ from: 22, to: 7 });
    expect(isQuietHour(new Date('2026-11-23T11:30:00Z'), parseQuietHours('22-7'))).toBe(true); // 06:30 Eastern
    expect(parseQuietHours('')).toBeNull();
    expect(parseQuietHours('9-9')).toBeNull();
    expect(parseQuietHours('25-3')).toBeNull();
    expect(isQuietHour(night, null)).toBe(false);
  });

  it('handles a same-day window', () => {
    const q = parseQuietHours('1-5')!;
    expect(isQuietHour(night, q)).toBe(true); // 03:30
    expect(isQuietHour(day, q)).toBe(false);
  });

  it('stretches the offline threshold overnight', () => {
    expect(offlineAfterSec(day)).toBe(OFFLINE_AFTER_SEC);
    expect(offlineAfterSec(night)).toBe(QUIET_OFFLINE_AFTER_SEC);
    // A beat 8 minutes ago is fine at night, an outage by day.
    const eightMinAgo = (t: Date) => new Date(t.getTime() - 8 * 60_000);
    expect(playerStatus(eightMinAgo(night), night.getTime())).toBe('online');
    expect(playerStatus(eightMinAgo(day), day.getTime())).toBe('offline');
  });
});
