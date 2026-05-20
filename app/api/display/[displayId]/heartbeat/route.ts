import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/display/[displayId]/heartbeat
 *
 * Body: { slideId: string | null }
 *
 * Called by the TV player on every slide change. Unauthenticated by design
 * — the displayId itself is the credential (it's a UUID embedded in the
 * kiosk URL, same trust model as the GET endpoint that serves slides).
 *
 * Writes the new currentSlideId, currentSlideStartedAt, and lastHeartbeatAt
 * so the admin Displays view can show what's on screen right now. If the
 * incoming slideId matches what's already stored, only lastHeartbeatAt is
 * touched — that way "time on screen" stays accurate across page reloads.
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
    // sendBeacon sometimes posts an empty body — that's fine, treat as
    // "still alive, no slide change."
  }

  const existing = await db.query.displays.findFirst({
    where: eq(displays.id, displayId),
    columns: { currentSlideId: true },
  });
  if (!existing) {
    return Response.json({ error: 'Unknown display' }, { status: 404 });
  }

  const slideChanged = slideId && slideId !== existing.currentSlideId;
  await db
    .update(displays)
    .set({
      lastHeartbeatAt: now,
      ...(slideChanged
        ? { currentSlideId: slideId, currentSlideStartedAt: now }
        : {}),
    })
    .where(eq(displays.id, displayId));

  return Response.json({ ok: true }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
