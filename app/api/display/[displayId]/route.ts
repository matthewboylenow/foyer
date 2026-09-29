import { getEligibleSlides, getDisplayById } from '@/lib/db/queries';
import { computePlaylistVersion } from '@/lib/fleet';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/display/[displayId]
 *
 * The player's playlist. Supports conditional requests: the response
 * carries an ETag derived from computePlaylistVersion(), and a request
 * with a matching If-None-Match gets a 304 after one cheap query instead
 * of the full slides + settings + media resolution.
 *
 * The player learns about changes from the `version` echoed on every
 * heartbeat response, so it only calls this on start-up, on a version
 * change, and on a slow safety-net timer.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ displayId: string }> },
) {
  const { displayId } = await params;

  try {
    const version = await computePlaylistVersion(displayId);
    const etag = version ? `"${version}"` : null;
    const ifNoneMatch = req.headers.get('if-none-match');
    if (etag && ifNoneMatch && ifNoneMatch.split(',').map((s) => s.trim()).includes(etag)) {
      return new Response(null, { status: 304, headers: { ...NO_STORE, ETag: etag } });
    }

    const [display, slides] = await Promise.all([
      getDisplayById(displayId),
      getEligibleSlides(displayId),
    ]);
    const orientation = display?.orientation === 'landscape' ? 'landscape' : 'portrait';
    return Response.json(
      { orientation, slides, version },
      { headers: etag ? { ...NO_STORE, ETag: etag } : NO_STORE },
    );
  } catch (err) {
    console.error('Display API error:', err);
    return Response.json(
      { orientation: 'portrait', slides: [], version: null },
      { status: 200, headers: NO_STORE },
    );
  }
}
