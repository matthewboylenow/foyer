import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { displays, slides, media, settings, type SlideWithContent } from '@/lib/db/schema';
import type { AgentInfo, DisplayEvent } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { getCurrentTenant } from '@/lib/tenant';
import { getOutages, getRecentEvents, noteOfflineIfSilent } from '@/lib/fleet';
import {
  agentStatus,
  historyStrip,
  playerStatus,
  uptimePercent,
  type Bucket,
  type LiveStatus,
} from '@/lib/monitoring';

const DAY_MS = 24 * 60 * 60 * 1000;
/** History strip: 7 days in 2-hour buckets. */
const STRIP_WINDOW_MS = 7 * DAY_MS;
const STRIP_BUCKETS = 84;

export interface DisplayStatusPayload {
  id: string;
  name: string;
  location: string | null;
  active: boolean;
  orientation: 'portrait' | 'landscape';
  hardware: 'pi' | 'optisigns' | 'browser';
  status: LiveStatus;
  lastHeartbeatAt: string | null;
  offlineSince: string | null;
  currentSlideStartedAt: string | null;
  currentSlide: (SlideWithContent & { resolvedMedia?: Record<string, string> }) | null;
  agent: {
    status: 'online' | 'offline' | 'none';
    lastSeenAt: string | null;
    info: AgentInfo | null;
  };
  pendingCommand: string | null;
  pendingCommandAt: string | null;
  screenshotUrl: string | null;
  screenshotAt: string | null;
  uptime: { day: number | null; week: number | null; month: number | null };
  strip: Bucket[];
  events: DisplayEvent[];
}

/**
 * GET /api/displays/status
 *
 * Everything the Displays page needs for every screen: live status, what's
 * on screen, Pi vitals, uptime history and recent events. Polled every 15s
 * while the page is open. Also performs lazy outage detection so the UI
 * is right even if the cron isn't running.
 */
export async function GET() {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json([]);

  const nowDate = new Date();
  const now = nowDate.getTime();

  const rawRows = await db.query.displays.findMany({
    where: eq(displays.tenantId, tenant.id),
  });
  // Lazy outage detection (idempotent; the cron does the same).
  const rows = await Promise.all(rawRows.map((d) => noteOfflineIfSilent(d, nowDate)));

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

  // Outage history + recent events, per display, in parallel.
  const history = await Promise.all(
    rows.map(async (d) => ({
      outages: await getOutages(d.id, 30 * DAY_MS, now),
      events: await getRecentEvents(d.id, 12),
    })),
  );

  const result: DisplayStatusPayload[] = rows.map((d, i) => {
    const slide = d.currentSlideId ? slideMap.get(d.currentSlideId) ?? null : null;
    const orientation = d.orientation === 'landscape' ? 'landscape' : 'portrait';
    // Pick the orientation-appropriate content slot so the now-playing
    // thumb matches what the TV is actually rendering.
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
      for (const [key, out] of [
        ['bgImageMediaId', 'bgImageUrl'],
        ['bgVideoMediaId', 'bgVideoUrl'],
        ['phoneMockupMediaId', 'phoneMockupUrl'],
      ] as const) {
        if (typeof c?.[key] === 'string') {
          const url = mediaMap.get(c[key] as string);
          if (url) resolvedMedia[out] = url;
        }
      }
    }

    const slideForResponse = slide && effectiveContent
      ? { ...slide, content: effectiveContent }
      : slide;

    const { outages, events } = history[i];
    const since = d.createdAt ? new Date(d.createdAt) : null;
    const iso = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString() : null);

    return {
      id: d.id,
      name: d.name,
      location: d.location,
      active: d.active,
      orientation,
      hardware: (d.hardware === 'pi' || d.hardware === 'optisigns' ? d.hardware : 'browser'),
      status: playerStatus(d.lastHeartbeatAt, now),
      lastHeartbeatAt: iso(d.lastHeartbeatAt),
      offlineSince: iso(d.offlineSince),
      currentSlideStartedAt: iso(d.currentSlideStartedAt),
      currentSlide: slideForResponse
        ? ({ ...(slideForResponse as SlideWithContent), resolvedMedia } as SlideWithContent & {
            resolvedMedia?: Record<string, string>;
          })
        : null,
      agent: {
        status: agentStatus(d.agentLastSeenAt, now),
        lastSeenAt: iso(d.agentLastSeenAt),
        info: (d.agentInfo as AgentInfo | null) ?? null,
      },
      pendingCommand: d.pendingCommand ?? null,
      pendingCommandAt: iso(d.pendingCommandAt),
      screenshotUrl: d.screenshotUrl ?? null,
      screenshotAt: iso(d.screenshotAt),
      uptime: {
        day: uptimePercent(outages, DAY_MS, { now, since }),
        week: uptimePercent(outages, 7 * DAY_MS, { now, since }),
        month: uptimePercent(outages, 30 * DAY_MS, { now, since }),
      },
      strip: historyStrip(outages, STRIP_WINDOW_MS, STRIP_BUCKETS, { now, since }),
      events,
    };
  });

  return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
