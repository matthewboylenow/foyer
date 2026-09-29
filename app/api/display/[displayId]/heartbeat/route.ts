import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { computePlaylistVersion, resolveOutage } from '@/lib/fleet';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * POST /api/display/[displayId]/heartbeat
 *
 * Body: { slideId: string | null }
 *
 * Called by the TV player once a minute (not on every slide change — that
 * was ~6,500 requests per display per day). Unauthenticated by design —
 * the displayId itself is the credential (it's a UUID embedded in the
 * kiosk URL, same trust model as the GET endpoint that serves slides).
 *
 * Does three things:
 *   1. Records liveness + what's on screen (currentSlideStartedAt only
 *      moves when the slide actually changed, so "time on screen" stays
 *      honest across reloads).
 *   2. Closes an open outage if this display had been marked offline.
 *   3. Answers with the current playlist `version` and a `reload` flag, so
 *      the player can refetch or reload without polling anything else.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ displayId: string }> },
) {
  const { displayId } = await params;
  const now = new Date();

  let slideId: string | null = null;
  try {
    const body = (await req.json()) as { slideId?: string | null };
    slideId = typeof body?.slideId === 'string' ? body.slideId : null;
  } catch {
    // Empty body — treat as "still alive, no slide change."
  }

  const existing = await db.query.displays.findFirst({
    where: eq(displays.id, displayId),
  });
  if (!existing) {
    return Response.json({ error: 'Unknown display' }, { status: 404 });
  }

  const slideChanged = slideId && slideId !== existing.currentSlideId;
  const reload = !!existing.reloadRequestedAt;

  const [, version] = await Promise.all([
    db
      .update(displays)
      .set({
        lastHeartbeatAt: now,
        ...(slideChanged ? { currentSlideId: slideId, currentSlideStartedAt: now } : {}),
        ...(reload ? { reloadRequestedAt: null } : {}),
      })
      .where(eq(displays.id, displayId)),
    computePlaylistVersion(displayId),
  ]);

  if (existing.offlineSince) {
    // Back from an outage — close it (and email if we had alerted).
    await resolveOutage(existing, now);
  }

  return Response.json({ ok: true, version, reload }, { headers: NO_STORE });
}
