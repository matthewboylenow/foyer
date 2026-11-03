import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * lib/ingest.ts: the contract, the text → HTML mapping, and the upsert
 * decision logic with the database mocked (no live DB in tests).
 */

// ─── In-memory fake of the drizzle calls upsertSlides makes ─────────────────

interface Row {
  id: string;
  tenantId: string;
  sourceId: string | null;
  title: string;
  templateType: string;
  content: unknown;
  scheduleType: string;
  startAt: Date | null;
  endAt: Date | null;
  weight: number;
  active: boolean;
  collectionId: string | null;
  updatedBy: string | null;
}

const state: { slides: Row[]; collections: { id: string; tenantId: string; name: string }[]; audit: unknown[]; published: unknown[] } = {
  slides: [],
  collections: [],
  audit: [],
  published: [],
};
let nextId = 1;

vi.mock('@/lib/db/client', () => {
  // Enough of the query builder for upsertSlides: findMany/findFirst with a
  // predicate we evaluate ourselves (the "where" objects are opaque, so the
  // fake keys off which table is being touched and the values given).
  const db = {
    query: {
      collections: {
        findFirst: async () => state.collections[0] ?? undefined,
      },
      slides: {
        findMany: async () => state.slides,
        findFirst: async () => state.slides[0],
      },
    },
    insert: (table: { _name?: string } & Record<string, unknown>) => ({
      values: (v: Record<string, unknown>) => ({
        returning: async () => {
          const id = `id-${nextId++}`;
          if ('name' in v) {
            state.collections.push({ id, tenantId: v.tenantId as string, name: v.name as string });
          } else {
            state.slides.push({ id, ...(v as Omit<Row, 'id'>) });
          }
          void table;
          return [{ id }];
        },
      }),
    }),
    update: () => ({
      set: (v: Partial<Row>) => ({
        where: () => {
          // Two update shapes exist: editorial update of one row (has title),
          // and prune (active:false only). Emulate each.
          if ('title' in v) {
            const target = state.slides.find((r) => r.title !== v.title && r.sourceId?.endsWith(':a'));
            if (target) Object.assign(target, v);
            return Promise.resolve();
          }
          return {
            returning: async () => {
              const pruned = state.slides.filter((r) => r.active && !currentKeys.has(r.sourceId ?? ''));
              pruned.forEach((r) => Object.assign(r, v));
              return pruned.map((r) => ({ id: r.id, sourceId: r.sourceId, title: r.title }));
            },
          };
        },
      }),
    }),
  };
  return { db };
});

vi.mock('@/lib/auth/session', () => ({ logAudit: async (row: unknown) => void state.audit.push(row) }));
vi.mock('@/lib/publish', () => ({ publishPlaylist: async (...args: unknown[]) => void state.published.push(args) }));

// The prune fake needs to know which keys were in the payload; set per call.
let currentKeys = new Set<string>();

import { IngestRequestSchema, textToBodyHtml, toSlideValues, splitSourceKey, upsertSlides } from '../ingest';

const base = {
  source: 'chat',
  slides: [
    {
      sourceId: 'a',
      title: 'Fest',
      content: { headline: 'Saint Helen Fest', meta: 'Sat · 5 PM', body: 'Join us.\n\nBring a friend.', cta: 'Sign up at sainthelen.org/fest.', ctaUrl: 'https://sainthelen.org/fest' },
      endAt: '2026-11-08T17:00:00-05:00',
    },
    { sourceId: 'b', title: 'Quote', templateType: 'welcome_quote' as const, content: { quote: 'Rejoice.', attribution: 'Phil 4:4' } },
  ],
};

describe('IngestRequestSchema', () => {
  it('accepts the documented payload and fills defaults', () => {
    const r = IngestRequestSchema.parse(base);
    expect(r.prune).toBe(false);
    expect(r.publish).toBe(false);
    expect(r.slides[0].templateType).toBe('general');
    expect(r.slides[0].weight).toBe(1);
    expect(r.slides[0].active).toBe(true);
  });

  it('requires a headline for general and a quote for welcome_quote', () => {
    const noHeadline = IngestRequestSchema.safeParse({ source: 'chat', slides: [{ sourceId: '1', title: 't', content: { body: 'x' } }] });
    expect(noHeadline.success).toBe(false);
    const noQuote = IngestRequestSchema.safeParse({ source: 'chat', slides: [{ sourceId: '1', title: 't', templateType: 'welcome_quote', content: {} }] });
    expect(noQuote.success).toBe(false);
  });

  it('rejects unknown fields, bad sources, non-https links and inverted dates', () => {
    expect(IngestRequestSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(IngestRequestSchema.safeParse({ ...base, source: 'Bad Source!' }).success).toBe(false);
    expect(
      IngestRequestSchema.safeParse({ source: 'chat', slides: [{ sourceId: '1', title: 't', content: { headline: 'h', ctaUrl: 'not a url' } }] }).success,
    ).toBe(false);
    expect(
      IngestRequestSchema.safeParse({
        source: 'chat',
        slides: [{ sourceId: '1', title: 't', content: { headline: 'h' }, startAt: '2026-11-09T00:00:00Z', endAt: '2026-11-08T00:00:00Z' }],
      }).success,
    ).toBe(false);
  });
});

describe('textToBodyHtml', () => {
  it('escapes, paragraphs on blank lines, bullets, bold, and a bold CTA line', () => {
    const html = textToBodyHtml('Hello <b>world</b> & **friends**\nsecond line\n\n- one\n- two', 'Visit us.');
    expect(html).toBe(
      '<p>Hello &lt;b&gt;world&lt;/b&gt; &amp; <strong>friends</strong><br>second line</p><ul><li>one</li><li>two</li></ul><p><strong>Visit us.</strong></p>',
    );
  });
  it('keeps the copy verbatim otherwise', () => {
    const text = 'Registration is open at the link below, or text DISCOVER to 908-860-8444.';
    expect(textToBodyHtml(text)).toBe(`<p>${text}</p>`);
  });
});

describe('toSlideValues', () => {
  it('builds General content with a small headline, QR and dated schedule', () => {
    const r = IngestRequestSchema.parse(base);
    const v = toSlideValues('tenant', 'chat', r.slides[0], 'mcp', 'coll');
    expect(v.sourceId).toBe('chat:a');
    expect(v.scheduleType).toBe('dated');
    expect(v.endAt?.toISOString()).toBe('2026-11-08T22:00:00.000Z');
    const c = v.content as { headlineSize: string; qrUrl?: string; body: string; templateType: string };
    expect(c.templateType).toBe('general');
    expect(c.headlineSize).toBe('small');
    expect(c.qrUrl).toBe('https://sainthelen.org/fest');
    expect(c.body).toContain('<strong>Sign up at sainthelen.org/fest.</strong>');
  });
  it('builds Welcome Quote content', () => {
    const r = IngestRequestSchema.parse(base);
    const v = toSlideValues('tenant', 'chat', r.slides[1], 'mcp', 'coll');
    expect(v.scheduleType).toBe('evergreen');
    expect(v.content).toMatchObject({ templateType: 'welcome_quote', quote: 'Rejoice.', attribution: 'Phil 4:4' });
  });
  it('splits source keys back apart', () => {
    expect(splitSourceKey('comms-portal:req:with:colons')).toEqual({ source: 'comms-portal', sourceId: 'req:with:colons' });
    expect(splitSourceKey(null)).toEqual({ source: null, sourceId: null });
  });
});

describe('upsertSlides', () => {
  beforeEach(() => {
    state.slides = [];
    state.collections = [];
    state.audit = [];
    state.published = [];
    nextId = 1;
  });

  it('creates, then reports unchanged on the identical resend, then updates and prunes', async () => {
    const req = IngestRequestSchema.parse(base);
    currentKeys = new Set(['chat:a', 'chat:b']);
    const first = await upsertSlides('tenant', req, 'mcp', 'mcp:upsert_slides');
    expect(first.summary).toEqual({ created: 2, updated: 0, unchanged: 0, pruned: 0 });
    expect(state.collections[0].name).toBe('From chat');
    expect(state.slides.every((s) => s.collectionId === state.collections[0].id)).toBe(true);
    expect(state.audit).toHaveLength(1);
    expect((state.audit[0] as { action: string }).action).toBe('mcp:upsert_slides');
    expect(state.published).toHaveLength(0);

    const again = await upsertSlides('tenant', req, 'mcp', 'mcp:upsert_slides');
    expect(again.summary).toEqual({ created: 0, updated: 0, unchanged: 2, pruned: 0 });

    const changed = IngestRequestSchema.parse({
      source: 'chat',
      prune: true,
      publish: true,
      slides: [{ sourceId: 'a', title: 'Fest 2', content: { headline: 'Saint Helen Fest 2' } }],
    });
    currentKeys = new Set(['chat:a']);
    const third = await upsertSlides('tenant', changed, 'mcp', 'mcp:upsert_slides');
    expect(third.summary).toEqual({ created: 0, updated: 1, unchanged: 0, pruned: 1 });
    expect(third.pruned[0].sourceId).toBe('b');
    expect(state.slides.find((s) => s.sourceId === 'chat:b')?.active).toBe(false);
    expect(third.published).toBe(true);
    expect(state.published).toHaveLength(1);
  });

  it('refuses duplicate sourceIds in one payload', async () => {
    const req = IngestRequestSchema.parse({ source: 'chat', slides: [base.slides[0], { ...base.slides[0], title: 'dup' }] });
    await expect(upsertSlides('tenant', req, 'mcp', 'x')).rejects.toThrow(/Duplicate sourceId/);
  });
});
