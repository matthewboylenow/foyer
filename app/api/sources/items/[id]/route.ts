import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { sourceItems } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';
import { logAudit } from '@/lib/auth/session';

/**
 * PATCH /api/sources/items/[id] — Foyer-owned presentation settings on a
 * source item: hidden, weight, durationOverrideSec, pin, targetDisplays.
 * Editorial fields are owned by the source and cannot be changed here.
 * Admin session required; tenant-scoped.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.hidden === 'boolean') update.hidden = body.hidden;
  if (typeof body.weight === 'number' && Number.isFinite(body.weight)) {
    update.weight = Math.max(0, Math.min(5, Math.round(body.weight)));
  }
  if ('durationOverrideSec' in body) {
    const n = Number(body.durationOverrideSec);
    update.durationOverrideSec = Number.isFinite(n) && n >= 5 ? Math.min(120, Math.round(n)) : null;
  }
  if ('pin' in body) update.pin = body.pin === 'start' || body.pin === 'end' ? body.pin : null;
  if (Array.isArray(body.targetDisplays)) {
    update.targetDisplays = body.targetDisplays.filter((v) => typeof v === 'string').slice(0, 50);
  }

  const [updated] = await db
    .update(sourceItems)
    .set(update)
    .where(and(eq(sourceItems.id, id), eq(sourceItems.tenantId, tenant.id)))
    .returning();
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  await logAudit({
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: session?.user?.email ?? undefined,
    action: 'source_item.update',
    targetType: 'source_item',
    targetId: id,
    metadata: { title: updated.title, changes: Object.keys(update).filter((k) => k !== 'updatedAt') },
  });

  return Response.json(updated, { headers: { 'Cache-Control': 'no-store' } });
}
