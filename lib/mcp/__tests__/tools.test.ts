import { describe, it, expect, vi } from 'vitest';
import type { Tenant } from '@/lib/db/schema';

/**
 * The MCP tool surface with the database mocked: every tool registers with
 * a description a client can act on, reads go to the right rows, writes
 * audit as mcp:<tool>, and nothing publishes unless asked.
 */

const slideRow = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 't1',
  sourceId: 'chat:a',
  title: 'Fest',
  templateType: 'general',
  content: { templateType: 'general', headline: 'Saint Helen Fest', meta: 'Sat', body: '<p>Join us.</p>' },
  contentLandscape: null,
  scheduleType: 'dated',
  startAt: null,
  endAt: new Date('2026-11-08T22:00:00Z'),
  targetDisplays: [],
  active: true,
  priority: false,
  pin: null,
  weight: 1,
  durationOverrideSec: null,
  collectionId: null,
  displayOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: 'mcp',
  updatedBy: 'mcp',
};

const updates: unknown[] = [];
const audit: { action: string }[] = [];
const published: unknown[] = [];

vi.mock('@/lib/db/client', () => ({
  db: {
    query: {
      slides: { findMany: async () => [slideRow, { ...slideRow, id: '22222222-2222-4222-8222-222222222222', sourceId: null, active: false, title: 'Old' }], findFirst: async () => slideRow },
      displays: { findMany: async () => [{ id: 'd1', name: 'Lobby', location: null, orientation: 'portrait', lastHeartbeatAt: new Date(), active: true }] },
      auditLog: { findMany: async () => [] },
      collections: { findFirst: async () => ({ id: 'c1' }) },
    },
    update: () => ({ set: (v: unknown) => ({ where: async () => void updates.push(v) }) }),
  },
}));
vi.mock('@/lib/auth/session', () => ({ logAudit: async (row: { action: string }) => void audit.push(row) }));
vi.mock('@/lib/publish', () => ({
  publishPlaylist: async (...a: unknown[]) => {
    published.push(a);
    return { id: 'snap', slideCount: 1, publishedAt: new Date() };
  },
  getPublishStatus: async () => ({ publishedAt: null, publishedBy: null, reason: null, slideCount: 0, dirty: true, changes: [{ id: 'x', title: 'Fest', kind: 'added' }] }),
}));

import { registerFoyerTools } from '../tools';

type Handler = (args: Record<string, unknown>) => Promise<{ content: { text: string }[]; isError?: boolean }>;
const tools = new Map<string, { config: { description: string; inputSchema: { parse: (v: unknown) => unknown } }; handler: Handler }>();
const fakeServer = {
  registerTool: (name: string, config: never, handler: Handler) => tools.set(name, { config, handler }),
};
const tenant = { id: 't1', name: 'Saint Helen Parish', slug: 'saint-helen' } as Tenant;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
registerFoyerTools(fakeServer as any, { tenant, actor: 'mcp' });

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const t = tools.get(name)!;
  const parsed = t.config.inputSchema.parse(args) as Record<string, unknown>;
  const res = await t.handler(parsed);
  return { res, data: res.isError ? null : JSON.parse(res.content[0].text) };
};

describe('registerFoyerTools', () => {
  it('registers the six tools, each with a plain-English description', () => {
    expect([...tools.keys()].sort()).toEqual(['get_screen_status', 'get_slide', 'list_slides', 'publish_screens', 'set_slide_active', 'upsert_slides']);
    for (const [, t] of tools) expect(t.config.description.length).toBeGreaterThan(40);
    expect(tools.get('upsert_slides')!.config.description).toMatch(/endAt/);
    expect(tools.get('upsert_slides')!.config.description).toMatch(/headline/i);
  });

  it('list_slides defaults to active and keeps the full body; source filter splits keys', async () => {
    const { data } = await call('list_slides');
    expect(data.count).toBe(1);
    expect(data.slides[0]).toMatchObject({ source: 'chat', sourceId: 'a', headline: 'Saint Helen Fest', body: '<p>Join us.</p>', active: true });
    const all = await call('list_slides', { status: 'all' });
    expect(all.data.count).toBe(2);
    const admin = await call('list_slides', { status: 'all', source: 'admin' });
    expect(admin.data.slides.map((s: { title: string }) => s.title)).toEqual(['Old']);
  });

  it('get_slide returns the content JSON untouched', async () => {
    const { data } = await call('get_slide', { id: slideRow.id });
    expect(data.content).toEqual(slideRow.content);
  });

  it('set_slide_active writes, audits as mcp:set_slide_active and stays staged by default', async () => {
    const { data } = await call('set_slide_active', { id: slideRow.id, active: false });
    expect(data.changed).toBe(true);
    expect(updates.at(-1)).toMatchObject({ active: false, updatedBy: 'mcp' });
    expect(audit.at(-1)?.action).toBe('mcp:set_slide_active');
    expect(published).toHaveLength(0);
    const again = await call('set_slide_active', { id: slideRow.id, active: false, publish: true });
    expect(again.data.published).toBe(true);
    expect(published).toHaveLength(1);
  });

  it('publish_screens publishes and reports what was staged', async () => {
    const { data } = await call('publish_screens');
    expect(data.slideCount).toBe(1);
    expect(data.changesPublished).toHaveLength(1);
    expect(audit.at(-1)?.action).toBe('mcp:publish_screens');
  });

  it('get_screen_status reports counts by source, TVs and the template catalog', async () => {
    const { data } = await call('get_screen_status');
    expect(data.slides.bySource).toEqual({ chat: { active: 1, inactive: 0 }, admin: { active: 0, inactive: 1 } });
    expect(data.displays[0]).toMatchObject({ name: 'Lobby', status: 'online' });
    expect(data.screens.upToDate).toBe(false);
    expect(data.templates.find((t: { templateType: string }) => t.templateType === 'general').fields.headline).toMatch(/50 characters/);
  });

  it('upsert_slides rejects an invalid payload at the schema', () => {
    const t = tools.get('upsert_slides')!;
    expect(() => t.config.inputSchema.parse({ source: 'chat', slides: [{ sourceId: '1', title: 't', content: {} }] })).toThrow();
  });
});
