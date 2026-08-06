import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays, slides, media, settings, type SlideWithContent } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';
/**
 * GET /api/displays/status
 *
 * Returns each display plus its current slide (with resolved media URLs)
 * and a derived status field. The admin Displays page polls this every
 * 60 seconds for the "Now Playing" view.
 *
 * Status is derived from lastHeartbeatAt (player pings every 5 minutes):
 *   - online  : heartbeat within 11 minutes (2 pings + slack)
 *   - stale   : within 30 minutes (probably reloading / WiFi blip)
 *   - offline : older, or never heartbeat
 */
export async function GET() {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getCurrentTenant();
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
  // Gather media ids from BOTH content slots — a landscape display's
  // current slide pulls from contentLandscape and we need its blob URLs too.
  for (const s of slideRows) {
    for (const slot of [s.content, s.contentLandscape]) {
      if (!slot || typeof slot !== 'object') continue;
      const c = slot as Record<string, unknown>;
      if (typeof c.logoMediaId === 'string') mediaIds.add(c.logoMediaId);
      if (typeof c.bgImageMediaId === 'string') mediaIds.add(c.bgImageMediaId);
      if (typeof c.bgVideoMediaId === 'string') mediaIds.add(c.bgVideoMediaId);
      if (typeof c.phoneMockupMediaId === 'string') mediaIds.add(c.phoneMockupMediaId);
    }
  }
  const mediaRows = mediaIds.size
    ? await db.query.media.findMany({ where: inArray(media.id, Array.from(mediaIds)) })
    : [];
  const mediaMap = new Map(mediaRows.map((m) => [m.id, m.blobUrl]));

  const now = Date.now();
  const result = rows.map((d) => {
    const slide = d.currentSlideId ? slideMap.get(d.currentSlideId) ?? null : null;
    const orientation = d.orientation === 'landscape' ? 'landscape' : 'portrait';
    // Pick the orientation-appropriate content slot so the now-playing
    // thumb matches what the TV is actually rendering. Empty slots fall
    // back to the other side (the player's eligibility would have done
    // the same).
    function pickSlot(s: typeof slide): Record<string, unknown> | null {
      if (!s) return null;
      const primary = orientation === 'landscape' ? s.contentLandscape : s.content;
      if (primary && typeof primary === 'object' && Object.keys(primary).length > 0) {
        return primary as Record<string, unknown>;
      }
      const fallback = orientation === 'landscape' ? s.content : s.contentLandscape;
      if (fallback && typeof fallback === 'object' && Object.keys(fallback).length > 0) {
        return fallback as Record<string, unknown>;
      }
      return null;
    }

    const effectiveContent = pickSlot(slide);
    let resolvedMedia: Record<string, string> | undefined;
    if (slide && effectiveContent) {
      const c = effectiveContent;
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
    // Player pings every 5 minutes: online = within 2 pings + slack,
    // stale = within ~30 min (reloading / WiFi blip), offline beyond.
    const status: 'online' | 'stale' | 'offline' =
      ageSec <= 660 ? 'online' : ageSec <= 1800 ? 'stale' : 'offline';

    // Replace content with the orientation-resolved slot so the consumer
    // (DisplayManager thumbnail) renders the right layout without caring
    // which side it came from.
    const slideForResponse = slide && effectiveContent
      ? { ...slide, content: effectiveContent }
      : slide;

    return {
      id: d.id,
      name: d.name,
      location: d.location,
      active: d.active,
      status,
      lastHeartbeatAt: d.lastHeartbeatAt,
      currentSlideStartedAt: d.currentSlideStartedAt,
      currentSlide: slideForResponse
        ? ({ ...(slideForResponse as SlideWithContent), resolvedMedia } as SlideWithContent & {
            resolvedMedia?: Record<string, string>;
          })
        : null,
    };
  });

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
