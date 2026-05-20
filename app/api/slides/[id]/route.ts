import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { slides } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getDefaultTenant } from '@/lib/db/queries';

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
  const tenant = await getDefaultTenant();

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: session?.user?.email ?? null,
  };

  const allowed = [
    'title', 'content', 'scheduleType', 'startAt', 'endAt',
    'active', 'weight', 'durationOverrideSec', 'targetDisplays',
    'collectionId',
  ];

  for (const key of allowed) {
    if (key in body) {
      if (key === 'startAt' || key === 'endAt') {
        updateData[key] = body[key] ? new Date(body[key]) : null;
      } else {
        updateData[key] = body[key];
      }
    }
  }

  const [updated] = await db
    .update(slides)
    .set(updateData)
    .where(eq(slides.id, id))
    .returning();

  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });

  if (tenant) {
    await logAudit({
      tenantId: tenant.id,
      userId: session?.user?.id,
      userEmail: session?.user?.email ?? undefined,
      action: 'slide.update',
      targetType: 'slide',
      targetId: id,
      metadata: { fields: Object.keys(updateData) },
    });
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
  const tenant = await getDefaultTenant();

  await db.delete(slides).where(eq(slides.id, id));

  if (tenant) {
    await logAudit({
      tenantId: tenant.id,
      userId: session?.user?.id,
      userEmail: session?.user?.email ?? undefined,
      action: 'slide.delete',
      targetType: 'slide',
      targetId: id,
    });
  }

  return new Response(null, { status: 204 });
}
