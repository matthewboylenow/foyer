import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { revalidateDisplayContent } from '@/lib/cacheTags';

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
  const update: Record<string, unknown> = {};
  if ('name' in body) update.name = body.name;
  if ('location' in body) update.location = body.location;
  if ('active' in body) update.active = body.active;
  if ('orientation' in body) {
    update.orientation = body.orientation === 'landscape' ? 'landscape' : 'portrait';
  }

  const [updated] = await db.update(displays).set(update).where(eq(displays.id, id)).returning();
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 });
  revalidateDisplayContent();
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
  await db.delete(displays).where(eq(displays.id, id));
  revalidateDisplayContent();
  return new Response(null, { status: 204 });
}
