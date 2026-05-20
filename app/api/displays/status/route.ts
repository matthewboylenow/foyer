import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays, slides, media, settings, type SlideWithContent } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { getDefaultTenant } from '@/lib/db/queries';

/**
 * GET /api/displays/status
 *
 * Returns each display plus its current slide (with resolved media URLs)
 * and a derived status field. The admin Displays page polls this every
 * 10 seconds for the "Now Playing" view.
 *
 * Status is derived from lastHeartbeatAt:
 *   - online  : heartbeat within 90s (player pings every 60s)
 *   - stale   : within 5 minutes (probably reloading / WiFi blip)
 *   - offline : older, or never heartbeat
 */
export async function GET() {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getDefaultTenant();
  if (!tenant) return Response.json([]);

  const rows = await db.query.displays.findMany({
    where: eq(displays.tenantId, tenant.id),
  });

  // Pull the set of current slides referenced by these displays in one query.
  const slideIds = rows
    .map((r) => r.currentSlideId)
    .filter((id): id is string => Boolean(id));
  const slideRows = slideIds.length
    ? await db.query.slides.findMany({ where: inArray(slides.id, slideIds) })
    : [];
  const slideMap = new Map(slideRows.map((s) => [s.id, s]));

  // Pull tenant settings + every media id referenced by any current slide.
  const tenantSettings = await db.query.settings.findFirst({
    where: eq(settings.tenantId, tenant.id),
  });
  const mediaIds = new Set<string>();
  if (tenantSettings?.logoMediaId) mediaIds.add(tenantSettings.logoMediaId);
  for (const s of slideRows) {
    const c = s.content as Record<string, unknown>;
    if (typeof c?.logoMediaId === 'string') mediaIds.add(c.logoMediaId);
    if (typeof c?.bgImageMediaId === 'string') mediaIds.add(c.bgImageMediaId);
    if (typeof c?.bgVideoMediaId === 'string') mediaIds.add(c.bgVideoMediaId);
    if (typeof c?.phoneMockupMediaId === 'string') mediaIds.add(c.phoneMockupMediaId);
  }
  const mediaRows = mediaIds.size
    ? await db.query.media.findMany({ where: inArray(media.id, Array.from(mediaIds)) })
    : [];
  const mediaMap = new Map(mediaRows.map((m) => [m.id, m.blobUrl]));

  const now = Date.now();
  const result = rows.map((d) => {
    const slide = d.currentSlideId ? slideMap.get(d.currentSlideId) ?? null : null;
    let resolvedMedia: Record<string, string> | undefined;
    if (slide) {
      const c = slide.content as Record<string, unknown>;
      resolvedMedia = {};
      if (slide.templateType === 'parish_identity') {
        const slideLogoId = typeof c?.logoMediaId === 'string' ? c.logoMediaId : null;
        const effectiveLogoId = slideLogoId ?? tenantSettings?.logoMediaId;
        if (effectiveLogoId) {
          const url = mediaMap.get(effectiveLogoId);
          if (url) resolvedMedia.logoUrl = url;
        }
      }
      if (typeof c?.bgImageMediaId === 'string') {
        const url = mediaMap.get(c.bgImageMediaId);
        if (url) resolvedMedia.bgImageUrl = url;
      }
      if (typeof c?.bgVideoMediaId === 'string') {
        const url = mediaMap.get(c.bgVideoMediaId);
        if (url) resolvedMedia.bgVideoUrl = url;
      }
      if (typeof c?.phoneMockupMediaId === 'string') {
        const url = mediaMap.get(c.phoneMockupMediaId);
        if (url) resolvedMedia.phoneMockupUrl = url;
      }
    }

    const lastHeartbeatMs = d.lastHeartbeatAt ? new Date(d.lastHeartbeatAt).getTime() : 0;
    const ageSec = lastHeartbeatMs ? Math.floor((now - lastHeartbeatMs) / 1000) : Infinity;
    const status: 'online' | 'stale' | 'offline' =
      ageSec <= 90 ? 'online' : ageSec <= 300 ? 'stale' : 'offline';

    return {
      id: d.id,
      name: d.name,
      location: d.location,
      active: d.active,
      status,
      lastHeartbeatAt: d.lastHeartbeatAt,
      currentSlideStartedAt: d.currentSlideStartedAt,
      currentSlide: slide
        ? ({ ...(slide as SlideWithContent), resolvedMedia } as SlideWithContent & {
            resolvedMedia?: Record<string, string>;
          })
        : null,
    };
  });

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
