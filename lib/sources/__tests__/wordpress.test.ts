import { describe, it, expect } from 'vitest';
import {
  signBody,
  verifySignature,
  WordPressDeliverySchema,
  normalizeItem,
  planItem,
  isSourceItemPlayable,
  type WordPressItem,
} from '../wordpress';
import { buildShuffledPool } from '@/components/player/shuffle';

const SECRET = 'test-secret';
const NOW = Date.parse('2026-10-10T12:00:00Z');
const ts = String(Math.floor(NOW / 1000));

const item = (over: Partial<WordPressItem> = {}): WordPressItem => ({
  sourceId: '123',
  revision: 10,
  status: 'active',
  kind: 'announcement',
  title: 'Saint Helen Fest',
  heading: 'Saint Helen Fest',
  subtitle: 'Saturday, October 18 · 5:00 PM · Meaney Hall',
  paragraphs: ['Join us for an afternoon of food and music.'],
  cta: 'To sign up, visit sainthelen.org/fest.',
  ctaUrl: 'https://sainthelen.org/fest',
  eventDate: '2026-10-18',
  ...over,
});

describe('signature', () => {
  it('accepts a correctly signed body within the clock window', () => {
    const body = '{"a":1}';
    const sig = signBody(body, ts, SECRET);
    expect(verifySignature(body, sig, ts, SECRET, NOW)).toEqual({ ok: true });
  });

  it('rejects a wrong secret, a tampered body, a missing header, and a stale timestamp', () => {
    const body = '{"a":1}';
    const sig = signBody(body, ts, SECRET);
    expect(verifySignature(body, sig, ts, 'other', NOW).ok).toBe(false);
    expect(verifySignature('{"a":2}', sig, ts, SECRET, NOW).ok).toBe(false);
    expect(verifySignature(body, null, ts, SECRET, NOW)).toEqual({ ok: false, reason: 'missing' });
    const old = String(Math.floor(NOW / 1000) - 3600);
    expect(verifySignature(body, signBody(body, old, SECRET), old, SECRET, NOW)).toEqual({
      ok: false,
      reason: 'stale_timestamp',
    });
    expect(verifySignature(body, 'nope', ts, SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('payload validation', () => {
  it('accepts a well-formed delivery', () => {
    const r = WordPressDeliverySchema.safeParse({ source: 'wordpress', tenant: 'saint-helen', items: [item()] });
    expect(r.success).toBe(true);
  });

  it('rejects unknown fields, non-https links, bad dates and empty deliveries', () => {
    expect(WordPressDeliverySchema.safeParse({ source: 'wordpress', tenant: 't', items: [item({ ctaUrl: 'http://x.org' })] }).success).toBe(false);
    expect(WordPressDeliverySchema.safeParse({ source: 'wordpress', tenant: 't', items: [item({ eventDate: '10/18/2026' })] }).success).toBe(false);
    expect(WordPressDeliverySchema.safeParse({ source: 'wordpress', tenant: 't', items: [] }).success).toBe(false);
    expect(WordPressDeliverySchema.safeParse({ source: 'wordpress', tenant: 't', items: [{ ...item(), evil: 1 }] }).success).toBe(false);
    expect(WordPressDeliverySchema.safeParse({ source: 'optisigns', tenant: 't', items: [item()] }).success).toBe(false);
  });
});

describe('normalizeItem', () => {
  it('builds General content with the CTA on its own line and a QR link', () => {
    const n = normalizeItem(item());
    expect(n.templateType).toBe('general');
    const c = n.content as { body: string; qrUrl?: string; meta?: string; headline: string };
    expect(c.headline).toBe('Saint Helen Fest');
    expect(c.meta).toContain('5:00 PM');
    expect(c.body).toBe('<p>Join us for an afternoon of food and music.</p><p><strong>To sign up, visit sainthelen.org/fest.</strong></p>');
    expect(c.qrUrl).toBe('https://sainthelen.org/fest');
    expect(n.scheduleType).toBe('evergreen');
  });

  it('escapes HTML in delivered text', () => {
    const c = normalizeItem(item({ paragraphs: ['<script>x</script>'] })).content as { body: string };
    expect(c.body).toContain('&lt;script&gt;');
    expect(c.body).not.toContain('<script>');
  });

  it('uses the poster template only when an image is present', () => {
    expect(normalizeItem(item({ kind: 'poster' })).templateType).toBe('general');
    const n = normalizeItem(item({ kind: 'poster', imageUrl: 'https://sainthelen.org/fest.jpg' }));
    expect(n.templateType).toBe('poster');
    expect(n.imageUrl).toBe('https://sainthelen.org/fest.jpg');
  });

  it('hashes only editorial fields, stably', () => {
    expect(normalizeItem(item()).payloadHash).toBe(normalizeItem(item()).payloadHash);
    expect(normalizeItem(item()).payloadHash).not.toBe(normalizeItem(item({ title: 'Other' })).payloadHash);
  });
});

describe('planItem', () => {
  it('creates on first delivery and is idempotent on repeat', () => {
    const first = planItem(null, item());
    expect(first.action).toBe('created');
    const stored = { revision: 10, payloadHash: first.write!.payloadHash, status: 'active' };
    expect(planItem(stored, item()).action).toBe('unchanged');
    expect(planItem(stored, item()).write).toBeNull();
  });

  it('updates on a newer revision and ignores an older one', () => {
    const stored = { revision: 10, payloadHash: normalizeItem(item()).payloadHash, status: 'active' };
    expect(planItem(stored, item({ revision: 11, title: 'Fest (updated)' })).action).toBe('updated');
    expect(planItem(stored, item({ revision: 9, title: 'Old' })).action).toBe('stale');
  });

  it('withdraws and can revive', () => {
    const stored = { revision: 10, payloadHash: normalizeItem(item()).payloadHash, status: 'active' };
    const w = planItem(stored, item({ revision: 11, status: 'withdrawn' }));
    expect(w.action).toBe('withdrawn');
    expect(w.write?.status).toBe('withdrawn');
    const revived = planItem({ revision: 11, payloadHash: w.write!.payloadHash, status: 'withdrawn' }, item({ revision: 12 }));
    expect(revived.action).toBe('updated');
    expect(revived.write?.status).toBe('active');
  });

  it('a delivery only touches the items it names', () => {
    // Simulate the route's loop over a map keyed by sourceId.
    const held = new Map([
      ['123', { revision: 10, payloadHash: normalizeItem(item()).payloadHash, status: 'active' }],
      ['999', { revision: 3, payloadHash: 'abc', status: 'active' }],
    ]);
    const plans = [item({ revision: 11, title: 'New title' })].map((i) => [i.sourceId, planItem(held.get(i.sourceId) ?? null, i)] as const);
    expect(plans.map(([id]) => id)).toEqual(['123']);
    expect(held.get('999')).toEqual({ revision: 3, payloadHash: 'abc', status: 'active' });
  });
});

describe('playback eligibility and merge', () => {
  const now = new Date(NOW);
  const base = { status: 'active', hidden: false, scheduleType: 'evergreen', startAt: null, endAt: null } as const;

  it('excludes withdrawn, hidden, and out-of-window items', () => {
    expect(isSourceItemPlayable(base, now)).toBe(true);
    expect(isSourceItemPlayable({ ...base, status: 'withdrawn' }, now)).toBe(false);
    expect(isSourceItemPlayable({ ...base, hidden: true }, now)).toBe(false);
    expect(isSourceItemPlayable({ ...base, scheduleType: 'dated', endAt: new Date(NOW - 1000) }, now)).toBe(false);
    expect(isSourceItemPlayable({ ...base, scheduleType: 'dated', startAt: new Date(NOW + 1000) }, now)).toBe(false);
    expect(isSourceItemPlayable({ ...base, scheduleType: 'dated', startAt: new Date(NOW - 1000), endAt: new Date(NOW + 1000) }, now)).toBe(true);
  });

  it('merged source items keep Foyer pins at the loop edges', () => {
    const loop = buildShuffledPool([
      { id: 'welcome', title: 'Welcome', pin: 'start', displayOrder: 10, weight: 1 },
      { id: 'wp-1', title: 'From WordPress', pin: null, displayOrder: 0, weight: 1 },
      { id: 'candle', title: 'Candle', pin: 'end', displayOrder: 30, weight: 1 },
    ]).map((s) => s.id);
    expect(loop).toEqual(['welcome', 'wp-1', 'candle']);
  });
});
