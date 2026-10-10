import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sourceDeliveries, sourceItems } from '@/lib/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
import {
  DELIVERY_HEADER,
  MAX_BODY_BYTES,
  SIGNATURE_HEADER,
  SOURCE,
  TIMESTAMP_HEADER,
  WordPressDeliverySchema,
  planItem,
  verifySignature,
  type ItemAction,
} from '@/lib/sources/wordpress';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/sources/wordpress — server-to-server inbound sync.
 *
 * Authentication is route-level: HMAC-SHA256 over `${timestamp}.${body}`
 * with WORDPRESS_SYNC_SECRET, sent as `X-Foyer-Signature: sha256=<hex>`
 * with `X-Foyer-Timestamp: <unix seconds>` (±5 min). No session, no
 * cookies. The middleware exempts this path from the session gate; the
 * signature check here is mandatory and is the only authentication.
 *
 * Tenant: resolved from the request host exactly like every other route
 * (`getCurrentTenant`); the payload's `tenant` slug must match or the
 * whole delivery is rejected. A sender for tenant A therefore cannot
 * touch tenant B's items even with a valid signature.
 *
 * Idempotent: same item + same revision + same content → 'unchanged';
 * lower revision → 'stale' (ignored). Only the items named in the
 * delivery are touched; Foyer slides are never read or written here.
 *
 * Full contract: docs/wordpress-sync.md.
 */
export async function POST(req: Request) {
  const secret = process.env.WORDPRESS_SYNC_SECRET;
  if (!secret) {
    return Response.json({ error: 'Sync is not configured on this server' }, { status: 503, headers: NO_STORE });
  }

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return Response.json({ error: 'Payload too large' }, { status: 413, headers: NO_STORE });
  }

  const sig = verifySignature(rawBody, req.headers.get(SIGNATURE_HEADER), req.headers.get(TIMESTAMP_HEADER), secret);
  const deliveryId = req.headers.get(DELIVERY_HEADER)?.slice(0, 128) ?? null;
  if (!sig.ok) {
    await logDelivery(null, false, sig.reason === 'stale_timestamp' ? 'stale_timestamp' : 'bad_signature', 0, {}, null, deliveryId);
    return Response.json({ error: 'Invalid signature' }, { status: 401, headers: NO_STORE });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    await logDelivery(null, false, 'bad_payload', 0, {}, 'invalid JSON', deliveryId);
    return Response.json({ error: 'Body is not JSON' }, { status: 400, headers: NO_STORE });
  }
  const parsed = WordPressDeliverySchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`);
    await logDelivery(null, false, 'bad_payload', 0, {}, issues.join('; ').slice(0, 500), deliveryId);
    return Response.json({ error: 'Invalid payload', issues }, { status: 400, headers: NO_STORE });
  }
  const delivery = parsed.data;

  const tenant = await getCurrentTenant();
  if (!tenant || tenant.slug !== delivery.tenant) {
    await logDelivery(tenant?.id ?? null, false, 'tenant_mismatch', delivery.items.length, {}, null, deliveryId);
    return Response.json({ error: 'Tenant mismatch' }, { status: 403, headers: NO_STORE });
  }

  // Reject duplicate sourceIds within one delivery rather than guess which wins.
  const ids = delivery.items.map((i) => i.sourceId);
  if (new Set(ids).size !== ids.length) {
    await logDelivery(tenant.id, false, 'bad_payload', ids.length, {}, 'duplicate sourceId in delivery', deliveryId);
    return Response.json({ error: 'Duplicate sourceId in delivery' }, { status: 400, headers: NO_STORE });
  }

  const now = new Date();
  const existingRows = await db.query.sourceItems.findMany({
    where: and(eq(sourceItems.tenantId, tenant.id), eq(sourceItems.source, SOURCE), inArray(sourceItems.sourceId, ids)),
  });
  const existing = new Map(existingRows.map((r) => [r.sourceId, r]));

  const results: { sourceId: string; revision: number; action: ItemAction }[] = [];
  const summary: Record<string, number> = {};
  try {
    for (const item of delivery.items) {
      const held = existing.get(item.sourceId) ?? null;
      const plan = planItem(held, item);
      summary[plan.action] = (summary[plan.action] ?? 0) + 1;
      results.push({ sourceId: item.sourceId, revision: item.revision, action: plan.action });
      if (!plan.write) continue;

      const editorial = {
        revision: plan.write.revision,
        status: plan.write.status,
        kind: plan.write.kind,
        templateType: plan.write.templateType,
        title: plan.write.title,
        content: plan.write.content,
        imageUrl: plan.write.imageUrl,
        scheduleType: plan.write.scheduleType,
        startAt: plan.write.startAt,
        endAt: plan.write.endAt,
        sourceUrl: plan.write.sourceUrl,
        sourceUpdatedAt: plan.write.sourceUpdatedAt,
        payloadHash: plan.write.payloadHash,
        lastReceivedAt: now,
        lastError: null,
        updatedAt: now,
      };
      if (held) {
        // Presentation columns (hidden, weight, duration, pin, targets) are
        // deliberately absent from `editorial` and survive the update.
        await db.update(sourceItems).set(editorial).where(eq(sourceItems.id, held.id));
      } else {
        await db.insert(sourceItems).values({
          tenantId: tenant.id,
          source: SOURCE,
          sourceId: item.sourceId,
          ...editorial,
        });
      }
    }
  } catch (err) {
    console.error('[sources/wordpress] delivery failed', err);
    await logDelivery(tenant.id, false, 'error', delivery.items.length, summary, err instanceof Error ? err.message.slice(0, 500) : 'error', deliveryId);
    return Response.json({ error: 'Delivery failed part way; retry is safe' }, { status: 500, headers: NO_STORE });
  }

  await logDelivery(tenant.id, true, 'accepted', delivery.items.length, summary, null, deliveryId);
  return Response.json({ ok: true, tenant: tenant.slug, deliveryId, results, summary }, { headers: NO_STORE });
}

async function logDelivery(
  tenantId: string | null,
  ok: boolean,
  outcome: string,
  itemCount: number,
  summary: Record<string, number>,
  error: string | null,
  deliveryId: string | null,
) {
  try {
    await db.insert(sourceDeliveries).values({ tenantId, source: SOURCE, ok, outcome, itemCount, summary, error, deliveryId });
  } catch (err) {
    console.error('[sources/wordpress] could not log delivery', err);
  }
}
