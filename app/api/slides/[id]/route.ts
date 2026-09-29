import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { slides } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getCurrentTenant } from '@/lib/tenant';
import { diffObjects } from '@/lib/diff';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slide = await db.query.slides.findFirst({ where: eq(slides.id, id) });
  if (!slide) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(slide);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const tenant = await getCurrentTenant();

  // Snapshot the existing slide so we can diff its fields vs the update.
  const existing = await db.query.slides.findFirst({ where: eq(slides.id, id) });
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: session?.user?.email ?? null,
  };

  const allowed = [
    'title', 'content', 'contentLandscape', 'scheduleType', 'startAt', 'endAt',
    'active', 'priority', 'weight', 'durationOverrideSec', 'targetDisplays',
    'collectionId',
  ];

  for (const key of allowed) {
    if (key in body) {
      if (key === 'startAt' || key === 'endAt') {
        updateData[key] = body[key] ? new Date(body[key]) : null;
      } else if (key === 'content') {
        // Empty-object content means "unauthor portrait" — keep the column
        // shape (NOT NULL) so existing query code stays simple.
        const c = body[key];
        updateData[key] = c && typeof c === 'object' && Object.keys(c).length > 0 ? c : {};
      } else if (key === 'contentLandscape') {
        // Empty / null landscape becomes null so the column reads as
        // "unauthored" and slides.contentLandscape can stay nullable.
        const c = body[key];
        updateData[key] =
          c && typeof c === 'object' && Object.keys(c).length > 0 ? c : null;
      } else {
        updateData[key] = body[key];
      }
    }
  }

  // After applying the update, at least one orientation must still be authored.
  const willHavePortrait =
    'content' in updateData
      ? Object.keys((updateData.content as Record<string, unknown>) ?? {}).length > 0
      : Object.keys((existing.content as Record<string, unknown>) ?? {}).length > 0;
  const willHaveLandscape =
    'contentLandscape' in updateData
      ? !!updateData.contentLandscape &&
        Object.keys(updateData.contentLandscape as Record<string, unknown>).length > 0
      : !!existing.contentLandscape &&
        Object.keys(existing.contentLandscape as Record<string, unknown>).length > 0;
  if (!willHavePortrait && !willHaveLandscape) {
    return Response.json(
      { error: 'Slide must have content for at least one orientation' },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(slides)
    .set(updateData)
    .where(eq(slides.id, id))
    .returning();

  if (tenant) {
    // Diff against the snapshot rather than against the requested payload —
    // catches no-op writes (e.g. PATCH with the same values) and produces
    // identical metadata regardless of which fields the caller sent.
    const prev = existing as unknown as Record<string, unknown>;
    const next = updated as unknown as Record<string, unknown>;
    // Drop bookkeeping fields from the diff — they always change.
    const ignore = new Set(['updatedAt', 'updatedBy']);
    const prevClean = Object.fromEntries(
      Object.entries(prev).filter(([k]) => !ignore.has(k)),
    );
    const nextClean = Object.fromEntries(
      Object.entries(next).filter(([k]) => !ignore.has(k)),
    );
    const changes = diffObjects(prevClean, nextClean);

    if (Object.keys(changes).length > 0) {
      await logAudit({
        tenantId: tenant.id,
        userId: session?.user?.id,
        userEmail: session?.user?.email ?? undefined,
        action: 'slide.update',
        targetType: 'slide',
        targetId: id,
        metadata: { changes, title: updated.title },
      });
    }
  }

  return Response.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const tenant = await getCurrentTenant();

  // Snapshot before delete so the audit row carries enough state to recover.
  const existing = await db.query.slides.findFirst({ where: eq(slides.id, id) });
  await db.delete(slides).where(eq(slides.id, id));

  if (tenant) {
    await logAudit({
      tenantId: tenant.id,
      userId: session?.user?.id,
      userEmail: session?.user?.email ?? undefined,
      action: 'slide.delete',
      targetType: 'slide',
      targetId: id,
      metadata: existing
        ? {
            title: existing.title,
            templateType: existing.templateType,
            snapshot: existing,
          }
        : undefined,
    });
  }

  return new Response(null, { status: 204 });
}
