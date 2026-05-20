import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { getDefaultTenant } from '@/lib/db/queries';

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getDefaultTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const body = await req.json();
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if ('globalDurationSec' in body) update.globalDurationSec = body.globalDurationSec;
  if ('videoEnabled' in body) update.videoEnabled = body.videoEnabled;
  if ('missionStatement' in body) update.missionStatement = body.missionStatement;

  const [updated] = await db
    .update(settings)
    .set(update)
    .where(eq(settings.tenantId, tenant.id))
    .returning();

  return Response.json(updated);
}
