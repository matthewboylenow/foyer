import { unstable_cache } from 'next/cache';
import { getEligibleSlides, getDisplayById } from '@/lib/db/queries';
import { DISPLAY_CONTENT_TAG } from '@/lib/cacheTags';

/**
 * Data-Cache-backed payload builder. Displays poll every 30s, 24/7 — served
 * from this cache, those polls never touch Postgres, which is what lets
 * Neon compute suspend instead of billing around the clock.
 *
 * Freshness: any admin mutation (slides, settings, displays, collections)
 * calls revalidateDisplayContent(), so edits reach screens on their next
 * poll — the 90-second update promise holds. The 5-minute revalidate is the
 * safety net and also bounds how late a *dated* slide appears/expires
 * (eligibility is computed at cache-fill time).
 */
const getDisplayPayload = unstable_cache(
  async (displayId: string) => {
    const [display, slides] = await Promise.all([
      getDisplayById(displayId),
      getEligibleSlides(displayId),
    ]);
    const orientation = display?.orientation === 'landscape' ? 'landscape' : 'portrait';
    return { orientation, slides };
  },
  ['display-payload'],
  { revalidate: 300, tags: [DISPLAY_CONTENT_TAG] },
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ displayId: string }> },
) {
  const { displayId } = await params;

  try {
    const payload = await getDisplayPayload(displayId);
    return Response.json(payload, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Display API error:', err);
    // 503, NOT a 200 with empty slides: the player ignores non-ok polls and
    // keeps playing from its local cache. An ok-empty response here would
    // blank the screen and overwrite the player's good cached copy.
    return Response.json(
      { error: 'Temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
