import { eq, and } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { db } from '@/lib/db/client';
import { media } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getCurrentTenant } from '@/lib/tenant';
import { getMediaById, getSlidesReferencingMedia, isMediaUsedBySettings } from '@/lib/db/queries';

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

  const m = await getMediaById(id);
  if (!m || m.tenantId !== tenant.id) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Refuse to delete media still referenced by a slide or by tenant settings.
  // Returning the offending slide titles lets the UI tell the user exactly
  // what to fix first.
  const referencingSlides = await getSlidesReferencingMedia(tenant.id, id);
  const usedBySettings = await isMediaUsedBySettings(tenant.id, id);
  if (referencingSlides.length > 0 || usedBySettings) {
    return Response.json(
      {
        error: 'In use',
        slides: referencingSlides.map((s) => ({ id: s.id, title: s.title })),
        usedBySettings,
      },
      { status: 409 },
    );
  }

  // Best-effort blob delete — if the blob is already gone (manual cleanup,
  // 404), proceed with the DB row removal so the library doesn't show
  // ghosts. Real errors (auth, network) still throw.
  try {
    await del(m.blobUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes('not found')) throw err;
  }

  await db.delete(media).where(and(eq(media.id, id), eq(media.tenantId, tenant.id)));

  await logAudit({
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: session?.user?.email ?? undefined,
    action: 'media.delete',
    targetType: 'media',
    targetId: id,
    metadata: { filename: m.filename, type: m.type },
  });

  return Response.json({ ok: true });
}
