import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { collections } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getCurrentTenant } from '@/lib/tenant';
const VALID_COLORS = ['rust', 'gold', 'navy', 'sage', 'plum', 'sky'] as const;

interface PatchBody {
  name?: string;
  color?: string;
  displayOrder?: number;
}

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

  const body = (await req.json()) as PatchBody;
  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.color === 'string' && (VALID_COLORS as readonly string[]).includes(body.color)) {
    updates.color = body.color;
  }
  if (typeof body.displayOrder === 'number') updates.displayOrder = body.displayOrder;
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const [updated] = await db
    .update(collections)
    .set(updates)
    .where(and(eq(collections.id, id), eq(collections.tenantId, tenant.id)))
    .returning();

  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  await logAudit({
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: session?.user?.email ?? undefined,
    action: 'collection.update',
    targetType: 'collection',
    targetId: id,
    metadata: updates,
  });

  return Response.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  // Slides reference this via ON DELETE SET NULL — they survive, just lose
  // their collection membership.
  await db
    .delete(collections)
    .where(and(eq(collections.id, id), eq(collections.tenantId, tenant.id)));

  await logAudit({
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: session?.user?.email ?? undefined,
    action: 'collection.delete',
    targetType: 'collection',
    targetId: id,
  });

  return Response.json({ ok: true });
}
