import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';
import { logAudit } from '@/lib/auth/session';
import { publishPlaylist } from '@/lib/publish';

/**
 * POST /api/publish — "Publish to screens."
 * Snapshots every active slide; the TVs switch to the new set within a
 * minute (heartbeat) without restarting mid-loop.
 */
export async function POST() {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const by = session?.user?.email ?? null;
  const snapshot = await publishPlaylist(tenant.id, by, 'manual');

  await logAudit({
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: by ?? undefined,
    action: 'playlist.publish',
    targetType: 'snapshot',
    targetId: snapshot.id,
    metadata: { slides: snapshot.slideCount },
  });

  return Response.json(
    { ok: true, publishedAt: snapshot.publishedAt, slideCount: snapshot.slideCount },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
