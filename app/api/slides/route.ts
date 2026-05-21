import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { slides } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getCurrentTenant } from '@/lib/tenant';
export async function GET() {
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json([]);
  const all = await db.query.slides.findMany({ where: eq(slides.tenantId, tenant.id) });
  return Response.json(all);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const body = await req.json();
  const {
    title,
    templateType,
    content,
    scheduleType,
    startAt,
    endAt,
    active,
    weight,
    durationOverrideSec,
    collectionId,
    targetDisplays,
  } = body;

  const [created] = await db
    .insert(slides)
    .values({
      tenantId: tenant.id,
      title,
      templateType,
      content: content ?? {},
      scheduleType: scheduleType ?? 'evergreen',
      startAt: startAt ? new Date(startAt) : null,
      endAt: endAt ? new Date(endAt) : null,
      active: active ?? true,
      weight: weight ?? 1,
      durationOverrideSec: durationOverrideSec ?? null,
      collectionId: collectionId ?? null,
      targetDisplays: targetDisplays ?? [],
      createdBy: session?.user?.email ?? null,
      updatedBy: session?.user?.email ?? null,
    })
    .returning();

  await logAudit({
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: session?.user?.email ?? undefined,
    action: 'slide.create',
    targetType: 'slide',
    targetId: created.id,
    metadata: {
      title: created.title,
      templateType: created.templateType,
      collectionId: created.collectionId ?? null,
    },
  });

  return Response.json(created, { status: 201 });
}
