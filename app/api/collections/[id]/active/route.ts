import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { slides, collections } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getCurrentTenant } from '@/lib/tenant';
/**
 * PATCH /api/collections/[id]/active
 * Body: { active: boolean }
 *
 * Bulk sets active=true|false on every slide in the collection. The
 * "pack" affordance — flip the whole Easter Triduum on without clicking
 * each slide. Returns the count of slides updated.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const { active } = (await req.json()) as { active?: boolean };
  if (typeof active !== 'boolean') {
    return Response.json({ error: 'active boolean required' }, { status: 400 });
  }

  // Confirm the collection belongs to this tenant before touching slides.
  const collection = await db.query.collections.findFirst({
    where: and(eq(collections.id, id), eq(collections.tenantId, tenant.id)),
  });
  if (!collection) return Response.json({ error: 'Not found' }, { status: 404 });

  const result = await db
    .update(slides)
    .set({ active })
    .where(and(eq(slides.tenantId, tenant.id), eq(slides.collectionId, id)))
    .returning({ id: slides.id });

  await logAudit({
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: session?.user?.email ?? undefined,
    action: active ? 'collection.activate' : 'collection.deactivate',
    targetType: 'collection',
    targetId: id,
    metadata: { count: result.length },
  });

  return Response.json({ ok: true, count: result.length });
}
