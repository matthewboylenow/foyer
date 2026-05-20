import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { collections } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getDefaultTenant, getCollectionsByTenant } from '@/lib/db/queries';

const VALID_COLORS = ['rust', 'gold', 'navy', 'sage', 'plum', 'sky'] as const;

export async function GET() {
  const tenant = await getDefaultTenant();
  if (!tenant) return Response.json([]);
  return Response.json(await getCollectionsByTenant(tenant.id));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenant = await getDefaultTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const body = (await req.json()) as { name?: string; color?: string };
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return Response.json({ error: 'Name required' }, { status: 400 });
  const color =
    typeof body?.color === 'string' && (VALID_COLORS as readonly string[]).includes(body.color)
      ? body.color
      : 'rust';

  // New collections land at the end of the list — find current max + 10.
  const existing = await db.query.collections.findMany({
    where: eq(collections.tenantId, tenant.id),
    orderBy: [desc(collections.displayOrder)],
    limit: 1,
  });
  const nextOrder = (existing[0]?.displayOrder ?? 0) + 10;

  const [created] = await db
    .insert(collections)
    .values({ tenantId: tenant.id, name, color, displayOrder: nextOrder })
    .returning();

  await logAudit({
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: session?.user?.email ?? undefined,
    action: 'collection.create',
    targetType: 'collection',
    targetId: created.id,
    metadata: { name, color },
  });

  return Response.json(created, { status: 201 });
}
