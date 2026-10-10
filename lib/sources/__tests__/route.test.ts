import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signBody } from '../wordpress';

/**
 * Route-level tests for POST /api/sources/wordpress with the database and
 * tenant resolution mocked. Verifies the request gate (signature, payload,
 * tenant) and the acknowledgement shape without a live database.
 */

const inserted: unknown[] = [];
const updated: unknown[] = [];
let heldRows: unknown[] = [];

vi.mock('@/lib/db/client', () => {
  const chain = (sink: unknown[]) => ({
    values: (v: unknown) => {
      sink.push(v);
      return Promise.resolve();
    },
    set: (v: unknown) => ({ where: () => { sink.push(v); return Promise.resolve(); } }),
  });
  return {
    db: {
      insert: () => chain(inserted),
      update: () => chain(updated),
      query: { sourceItems: { findMany: async () => heldRows } },
    },
  };
});

vi.mock('@/lib/tenant', () => ({
  getCurrentTenant: async () => ({ id: 'tenant-a', slug: 'saint-helen', name: 'Saint Helen' }),
}));

const SECRET = 'route-test-secret';

function request(body: string, opts: { sign?: boolean; secret?: string; ts?: string } = {}) {
  const ts = opts.ts ?? String(Math.floor(Date.now() / 1000));
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-foyer-timestamp': ts };
  if (opts.sign !== false) headers['x-foyer-signature'] = signBody(body, ts, opts.secret ?? SECRET);
  return new Request('https://foyer.sainthelen.org/api/sources/wordpress', { method: 'POST', headers, body });
}

const delivery = (tenant = 'saint-helen') =>
  JSON.stringify({
    source: 'wordpress',
    tenant,
    items: [
      {
        sourceId: '42',
        revision: 5,
        status: 'active',
        kind: 'announcement',
        title: 'Harvestfest',
        paragraphs: ['Saturday in the parking lot.'],
        cta: 'Sign up at sainthelen.org/fest.',
        ctaUrl: 'https://sainthelen.org/fest',
      },
    ],
  });

describe('POST /api/sources/wordpress', () => {
  beforeEach(() => {
    process.env.WORDPRESS_SYNC_SECRET = SECRET;
    inserted.length = 0;
    updated.length = 0;
    heldRows = [];
  });

  it('refuses when the secret is not configured', async () => {
    delete process.env.WORDPRESS_SYNC_SECRET;
    const { POST } = await import('@/app/api/sources/wordpress/route');
    const res = await POST(request(delivery()));
    expect(res.status).toBe(503);
  });

  it('rejects unsigned and wrongly signed requests without touching items', async () => {
    const { POST } = await import('@/app/api/sources/wordpress/route');
    expect((await POST(request(delivery(), { sign: false }))).status).toBe(401);
    expect((await POST(request(delivery(), { secret: 'wrong' }))).status).toBe(401);
    // Only delivery-log rows were written, never source items.
    expect(inserted.every((row) => (row as { outcome?: string }).outcome === 'bad_signature')).toBe(true);
    expect(updated).toHaveLength(0);
  });

  it("rejects a delivery addressed to another tenant", async () => {
    const { POST } = await import('@/app/api/sources/wordpress/route');
    const res = await POST(request(delivery('other-parish')));
    expect(res.status).toBe(403);
    expect(inserted.some((row) => (row as { outcome?: string }).outcome === 'tenant_mismatch')).toBe(true);
    expect(inserted.some((row) => (row as { sourceId?: string }).sourceId === '42')).toBe(false);
  });

  it('rejects an invalid payload with reasons', async () => {
    const { POST } = await import('@/app/api/sources/wordpress/route');
    const bad = JSON.stringify({ source: 'wordpress', tenant: 'saint-helen', items: [{ sourceId: '1' }] });
    const res = await POST(request(bad));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { issues: string[] };
    expect(json.issues.length).toBeGreaterThan(0);
  });

  it('creates on first delivery and acknowledges item identity and revision', async () => {
    const { POST } = await import('@/app/api/sources/wordpress/route');
    const res = await POST(request(delivery()));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; results: { sourceId: string; revision: number; action: string }[] };
    expect(json.ok).toBe(true);
    expect(json.results).toEqual([{ sourceId: '42', revision: 5, action: 'created' }]);
    const row = inserted.find((r) => (r as { sourceId?: string }).sourceId === '42') as Record<string, unknown>;
    expect(row.tenantId).toBe('tenant-a');
    expect(row.templateType).toBe('general');
    // Presentation columns are not part of the sync write.
    expect('hidden' in row).toBe(false);
    expect('pin' in row).toBe(false);
  });

  it('is idempotent: re-delivering the same revision is unchanged', async () => {
    const { POST } = await import('@/app/api/sources/wordpress/route');
    const first = await POST(request(delivery()));
    const created = inserted.find((r) => (r as { sourceId?: string }).sourceId === '42') as Record<string, unknown>;
    heldRows = [{ id: 'row-42', sourceId: '42', revision: 5, payloadHash: created.payloadHash, status: 'active' }];
    const again = await POST(request(delivery()));
    const json = (await again.json()) as { results: { action: string }[] };
    expect(first.status).toBe(200);
    expect(json.results[0].action).toBe('unchanged');
    expect(updated).toHaveLength(0);
  });
});
