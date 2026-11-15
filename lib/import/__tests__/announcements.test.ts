import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ db: {} }));
vi.mock('@/lib/auth/session', () => ({ logAudit: async () => {} }));
vi.mock('@/lib/publish', () => ({ publishPlaylist: async () => ({}) }));

import { findDuplicates, isPastAnnouncement, isSameAnnouncement, todayYmd } from '../announcements';

describe('isSameAnnouncement', () => {
  it('matches the same event under slightly different headings', () => {
    expect(isSameAnnouncement({ heading: 'Breakfast with Santa', eventDate: '2026-12-05' }, { id: '1', title: 'Breakfast With Santa', headline: 'Breakfast With Santa', eventDate: '2026-12-05' })).toBe(true);
    expect(isSameAnnouncement({ heading: 'Christmas Concert' }, { id: '1', title: 'Christmas Concert: Save the Date', headline: 'Christmas Concert: Save the Date' })).toBe(true);
    expect(isSameAnnouncement({ heading: 'Thanksgiving & Christmas', eventDate: '2026-11-22' }, { id: '1', title: 'Thanksgiving and Christmas Donations', headline: 'Thanksgiving and Christmas Donations', eventDate: '2026-11-22' })).toBe(true);
  });
  it('does not match different events', () => {
    expect(isSameAnnouncement({ heading: 'Teen Bible Study', eventDate: '2026-11-15' }, { id: '1', title: 'Abide Young Adult Ministry', headline: 'Abide Young Adult Ministry', eventDate: '2026-11-12' })).toBe(false);
    expect(isSameAnnouncement({ heading: 'Ministry Fair', eventDate: '2026-11-15' }, { id: '1', title: 'Ministry Fair', headline: 'Ministry Fair', eventDate: '2026-10-25' })).toBe(true);
    expect(isSameAnnouncement({ heading: 'Advent Mass Times', eventDate: '2026-12-01' }, { id: '1', title: 'Christmas Mass Times', headline: 'Christmas Mass Times', eventDate: '2026-12-25' })).toBe(false);
  });
  it('findDuplicates maps item index to the slide', () => {
    const d = findDuplicates([{ heading: 'A B C' }, { heading: 'Breakfast with Santa' }], [{ id: 's', title: 'Breakfast With Santa' }]);
    expect([...d.keys()]).toEqual([1]);
  });
});

describe('isPastAnnouncement', () => {
  const now = new Date('2026-11-15T15:00:00Z');
  const base = { active: true, pin: null, priority: false, templateType: 'general', scheduleType: 'dated', endAt: null, content: {} };
  it('is past when the end date has gone by', () => {
    expect(isPastAnnouncement({ ...base, endAt: new Date('2026-11-14T10:00:00Z') }, now)).toBe(true);
    expect(isPastAnnouncement({ ...base, endAt: new Date('2026-11-23T10:00:00Z') }, now)).toBe(false);
  });
  it('falls back to the event date when there is no end date', () => {
    expect(isPastAnnouncement({ ...base, scheduleType: 'evergreen', content: { eventDate: '2026-11-13' } }, now)).toBe(true);
    expect(isPastAnnouncement({ ...base, scheduleType: 'evergreen', content: { eventDate: '2026-11-15' } }, now)).toBe(false);
    expect(isPastAnnouncement({ ...base, scheduleType: 'evergreen', content: {} }, now)).toBe(false);
  });
  it('never touches pins, takeovers, off slides or parish templates', () => {
    expect(isPastAnnouncement({ ...base, pin: 'end', endAt: new Date('2026-01-01') }, now)).toBe(false);
    expect(isPastAnnouncement({ ...base, priority: true, endAt: new Date('2026-01-01') }, now)).toBe(false);
    expect(isPastAnnouncement({ ...base, active: false, endAt: new Date('2026-01-01') }, now)).toBe(false);
    expect(isPastAnnouncement({ ...base, templateType: 'mass_schedule', endAt: new Date('2026-01-01') }, now)).toBe(false);
  });
  it('todayYmd is the parish day', () => {
    expect(todayYmd(new Date('2026-11-16T03:30:00Z'))).toBe('2026-11-15');
  });
});
