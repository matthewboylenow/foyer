import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { getDefaultTenant } from '@/lib/db/queries';

export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getDefaultTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const { name, location } = await req.json();
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 });

  const [created] = await db
    .insert(displays)
    .values({ tenantId: tenant.id, name: name.trim(), location: location?.trim() || null })
    .returning();

  return Response.json(created, { status: 201 });
}
