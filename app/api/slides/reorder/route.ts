import { db } from '@/lib/db/client';
import { slides } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getCurrentTenant } from '@/lib/tenant';
import { revalidateDisplayContent } from '@/lib/cacheTags';
/**
 * PATCH /api/slides/reorder
 *
 * Body: { ids: string[] }  — slides in the desired admin-grid order.
 *
 * Assigns displayOrder = (index + 1) * 10 so future single-card inserts
 * can slot in between without renumbering the whole list. Admin-only
 * sort; player rotation is untouched (still weighted shuffle).
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const { ids } = (await req.json()) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: 'ids[] required' }, { status: 400 });
  }

  await Promise.all(
    ids.map((id, index) =>
      db
        .update(slides)
        .set({ displayOrder: (index + 1) * 10 })
        .where(and(eq(slides.id, id), eq(slides.tenantId, tenant.id))),
    ),
  );

  await logAudit({
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: session?.user?.email ?? undefined,
    action: 'slide.reorder',
    targetType: 'slide',
    metadata: { count: ids.length },
  });

  revalidateDisplayContent();
  return Response.json({ ok: true, count: ids.length });
}
