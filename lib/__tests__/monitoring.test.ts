import { describe, it, expect } from 'vitest';
import {
  uptimePercent,
  historyStrip,
  playerStatus,
  agentStatus,
  decodeThrottled,
  parseEmailList,
  formatDuration,
  type Outage,
} from '../monitoring';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const now = Date.parse('2026-09-29T12:00:00Z');

describe('uptimePercent', () => {
  it('is 100 with no outages', () => {
    expect(uptimePercent([], DAY, { now })).toBe(100);
  });

  it('subtracts a closed outage inside the window', () => {
    const outages: Outage[] = [
      { start: new Date(now - 6 * HOUR), end: new Date(now - 3 * HOUR) },
    ];
    // 3h down out of 24h = 87.5%
    expect(uptimePercent(outages, DAY, { now })).toBe(87.5);
  });

  it('clips an outage that started before the window', () => {
    const outages: Outage[] = [
      { start: new Date(now - 30 * HOUR), end: new Date(now - 22 * HOUR) },
    ];
    // only 2h of it falls inside the last 24h
    expect(uptimePercent(outages, DAY, { now })).toBeCloseTo(91.7, 1);
  });

  it('counts an open outage up to now', () => {
    const outages: Outage[] = [{ start: new Date(now - 12 * HOUR), end: null }];
    expect(uptimePercent(outages, DAY, { now })).toBe(50);
  });

  it('excludes time before the display existed', () => {
    const since = new Date(now - 2 * HOUR);
    const outages: Outage[] = [{ start: new Date(now - 1 * HOUR), end: null }];
    // Display is 2h old, down for the last 1h → 50%, not ~96%.
    expect(uptimePercent(outages, DAY, { now, since })).toBe(50);
  });

  it('returns null when the display is newer than now', () => {
    expect(uptimePercent([], DAY, { now, since: new Date(now + 1000) })).toBeNull();
  });
});

describe('historyStrip', () => {
  it('marks buckets up, partial, down and unknown', () => {
    const since = new Date(now - 3 * HOUR);
    const outages: Outage[] = [
      // Whole second-to-last bucket + half of the last one.
      { start: new Date(now - 2 * HOUR), end: new Date(now - 30 * 60_000) },
    ];
    const strip = historyStrip(outages, 4 * HOUR, 4, { now, since });
    expect(strip.map((b) => b.state)).toEqual(['unknown', 'up', 'down', 'partial']);
  });

  it('is all up with no outages', () => {
    const strip = historyStrip([], 7 * DAY, 84, { now });
    expect(strip).toHaveLength(84);
    expect(strip.every((b) => b.state === 'up')).toBe(true);
  });
});

describe('status helpers', () => {
  it('classifies the player by heartbeat age', () => {
    expect(playerStatus(null, now)).toBe('offline');
    expect(playerStatus(new Date(now - 30_000), now)).toBe('online');
    expect(playerStatus(new Date(now - 200_000), now)).toBe('stale');
    expect(playerStatus(new Date(now - 600_000), now)).toBe('offline');
  });

  it('classifies the agent', () => {
    expect(agentStatus(null, now)).toBe('none');
    expect(agentStatus(new Date(now - 60_000), now)).toBe('online');
    expect(agentStatus(new Date(now - 600_000), now)).toBe('offline');
  });
});

describe('decodeThrottled', () => {
  it('returns nothing for a healthy Pi', () => {
    expect(decodeThrottled('throttled=0x0')).toEqual([]);
    expect(decodeThrottled(undefined)).toEqual([]);
  });

  it('decodes under-voltage since boot', () => {
    expect(decodeThrottled('0x50000')).toEqual([
      'Under-voltage since boot',
      'Throttled since boot',
    ]);
  });
});

describe('parseEmailList', () => {
  it('splits, trims, lowercases and de-dupes', () => {
    expect(parseEmailList('A@x.org, b@y.com\nA@x.org; nope')).toEqual(['a@x.org', 'b@y.com']);
  });
});

describe('formatDuration', () => {
  it('formats sensible units', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(200)).toBe('3m 20s');
    expect(formatDuration(7500)).toBe('2h 5m');
    expect(formatDuration(90000)).toBe('1d 1h');
  });
});
