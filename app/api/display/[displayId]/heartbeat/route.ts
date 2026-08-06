import { sql, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays } from '@/lib/db/schema';

/**
 * POST /api/display/[displayId]/heartbeat
 *
 * Body: { slideId: string | null }
 *
 * Called by the TV player every 5 minutes (it used to fire on every slide
 * change — a write every ~15s per display, 24/7, which alone kept Neon
 * compute awake around the clock). Unauthenticated by design — the
 * displayId itself is the credential (a UUID embedded in the kiosk URL,
 * same trust model as the GET endpoint that serves slides).
 *
 * Single round trip: the CASE keeps currentSlideStartedAt stable when the
 * reported slide hasn't changed (so "time on screen" survives reloads),
 * without a SELECT-then-UPDATE pair.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ displayId: string }> },
) {
  const { displayId } = await params;

  let slideId: string | null = null;
  try {
    const body = (await req.json()) as { slideId?: string | null };
    slideId = typeof body?.slideId === 'string' ? body.slideId : null;
  } catch {
    // sendBeacon sometimes posts an empty body — that's fine, treat as
    // "still alive, no slide change."
  }

  const updated = await db
    .update(displays)
    .set({
      lastHeartbeatAt: sql`now()`,
      ...(slideId
        ? {
            currentSlideStartedAt: sql`CASE WHEN ${displays.currentSlideId} IS NOT DISTINCT FROM ${slideId} THEN ${displays.currentSlideStartedAt} ELSE now() END`,
            currentSlideId: slideId,
          }
        : {}),
    })
    .where(eq(displays.id, displayId))
    .returning({ id: displays.id });

  if (updated.length === 0) {
    return Response.json({ error: 'Unknown display' }, { status: 404 });
  }

  return Response.json({ ok: true }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
