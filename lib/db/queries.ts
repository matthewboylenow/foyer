import { eq, and, or, isNull, lte, gte, asc, desc } from 'drizzle-orm';
import { db } from './client';
import { slides, displays, settings, tenants, auditLog, errors, collections, media } from './schema';
import type { SlideWithContent, SlideContent, SlideOrientation } from './schema';

/**
 * Picks the orientation-appropriate content slot for a slide and reports
 * whether that slot is actually populated. An empty `content` object ({})
 * counts as "no portrait content" — same for a null `contentLandscape`.
 */
function pickContent(
  slide: { content: unknown; contentLandscape: unknown },
  orientation: SlideOrientation,
): { effective: SlideContent | null; available: boolean } {
  const raw = orientation === 'landscape' ? slide.contentLandscape : slide.content;
  if (raw == null) return { effective: null, available: false };
  if (typeof raw !== 'object') return { effective: null, available: false };
  // Empty object = unauthored for this orientation
  if (Object.keys(raw as Record<string, unknown>).length === 0) {
    return { effective: null, available: false };
  }
  return { effective: raw as SlideContent, available: true };
}

/**
 * Returned to the player. `content` is the orientation-resolved content
 * (no more `contentLandscape` field) so existing template props "just work."
 */
export type EligibleSlide = Omit<SlideWithContent, 'contentLandscape'> & {
  /** Resolved blob URLs for any media referenced by content (filled server-side) */
  resolvedMedia?: Record<string, string>;
};

export async function getEligibleSlides(displayId: string): Promise<EligibleSlide[]> {
  const display = await db.query.displays.findFirst({
    where: eq(displays.id, displayId),
  });
  if (!display || !display.active) return [];

  const orientation = (display.orientation === 'landscape' ? 'landscape' : 'portrait') as SlideOrientation;

  const now = new Date();
  const eligible = await db.query.slides.findMany({
    where: and(
      eq(slides.tenantId, display.tenantId),
      eq(slides.active, true),
      or(
        eq(slides.scheduleType, 'evergreen'),
        and(
          eq(slides.scheduleType, 'dated'),
          or(isNull(slides.startAt), lte(slides.startAt, now)),
          or(isNull(slides.endAt), gte(slides.endAt, now)),
        ),
      ),
    ),
    orderBy: [desc(slides.updatedAt)],
  });

  // Filter by display targeting AND by orientation availability. A slide
  // with empty content for this display's orientation is filtered out —
  // marked portrait-only doesn't run on a landscape screen and vice versa.
  type SlidePicked = (typeof eligible)[number] & { _effective: SlideContent };
  const filtered: SlidePicked[] = [];
  for (const s of eligible) {
    const targets = (s.targetDisplays as string[]) ?? [];
    if (targets.length > 0 && !targets.includes(displayId)) continue;
    const { effective, available } = pickContent(s, orientation);
    if (!available || !effective) continue;
    filtered.push({ ...s, _effective: effective });
  }

  // Resolve media references — gather all media IDs from the EFFECTIVE
  // (orientation-resolved) content, look them up, attach URLs.
  const tenantSettings = await db.query.settings.findFirst({
    where: eq(settings.tenantId, display.tenantId),
  });

  const mediaIds = new Set<string>();
  if (tenantSettings?.logoMediaId) mediaIds.add(tenantSettings.logoMediaId);
  for (const s of filtered) {
    const c = s._effective as unknown as Record<string, unknown>;
    if (typeof c?.logoMediaId === 'string') mediaIds.add(c.logoMediaId);
    if (typeof c?.bgImageMediaId === 'string') mediaIds.add(c.bgImageMediaId);
    if (typeof c?.bgVideoMediaId === 'string') mediaIds.add(c.bgVideoMediaId);
    if (typeof c?.phoneMockupMediaId === 'string') mediaIds.add(c.phoneMockupMediaId);
  }

  const mediaRows = mediaIds.size > 0
    ? await db.query.media.findMany({ where: (m, { inArray }) => inArray(m.id, Array.from(mediaIds)) })
    : [];
  const mediaMap = new Map(mediaRows.map((m) => [m.id, m.blobUrl]));

  return filtered.map((s): EligibleSlide => {
    const c = s._effective as unknown as Record<string, unknown>;
    const resolved: Record<string, string> = {};
    // For ParishIdentity: fall back to tenant logo if slide doesn't override
    if (s.templateType === 'parish_identity') {
      const slideLogoId = typeof c?.logoMediaId === 'string' ? c.logoMediaId : null;
      const effectiveLogoId = slideLogoId ?? tenantSettings?.logoMediaId;
      if (effectiveLogoId) {
        const url = mediaMap.get(effectiveLogoId);
        if (url) resolved.logoUrl = url;
      }
    }
    if (typeof c?.bgImageMediaId === 'string') {
      const url = mediaMap.get(c.bgImageMediaId);
      if (url) resolved.bgImageUrl = url;
    }
    if (typeof c?.bgVideoMediaId === 'string') {
      const url = mediaMap.get(c.bgVideoMediaId);
      if (url) resolved.bgVideoUrl = url;
    }
    if (typeof c?.phoneMockupMediaId === 'string') {
      const url = mediaMap.get(c.phoneMockupMediaId);
      if (url) resolved.phoneMockupUrl = url;
    }
    // Strip contentLandscape from the returned shape and replace content
    // with the orientation-resolved effective content.
    const { content: _origContent, contentLandscape: _origLandscape, _effective, ...rest } = s;
    void _origContent; void _origLandscape;
    return { ...rest, content: _effective, resolvedMedia: resolved };
  });
}


export async function getSlidesByTenant(tenantId: string) {
  // displayOrder ASC puts user-curated cards first; updatedAt DESC keeps
  // unsorted slides (displayOrder = 0) newest-first as a tiebreaker.
  return db.query.slides.findMany({
    where: eq(slides.tenantId, tenantId),
    orderBy: [asc(slides.displayOrder), desc(slides.updatedAt)],
  });
}

export async function getSlideById(id: string) {
  return db.query.slides.findFirst({
    where: eq(slides.id, id),
  });
}

/**
 * Like getSlidesByTenant but resolves every referenced media id to its
 * blob URL so the admin grid can render real previews (bg image, logo,
 * phone mockup). Falls back to tenant logo for parish_identity slides
 * that don't override.
 */
/**
 * Collects every media id referenced anywhere in a content blob (handles
 * null/empty/non-object safely).
 */
function collectContentMediaIds(content: unknown, sink: Set<string>) {
  if (!content || typeof content !== 'object') return;
  const c = content as Record<string, unknown>;
  if (typeof c.logoMediaId === 'string') sink.add(c.logoMediaId);
  if (typeof c.bgImageMediaId === 'string') sink.add(c.bgImageMediaId);
  if (typeof c.bgVideoMediaId === 'string') sink.add(c.bgVideoMediaId);
  if (typeof c.phoneMockupMediaId === 'string') sink.add(c.phoneMockupMediaId);
}

/**
 * Resolves a single content blob's media ids to blob URLs. Returns null
 * if the content is empty / unauthored (so the caller can mark that
 * orientation as unavailable for this slide).
 */
function resolveContentMedia(
  content: unknown,
  templateType: string,
  tenantLogoMediaId: string | null,
  mediaMap: Map<string, string>,
): Record<string, string> | null {
  if (!content || typeof content !== 'object') return null;
  if (Object.keys(content as Record<string, unknown>).length === 0) return null;
  const c = content as Record<string, unknown>;
  const resolved: Record<string, string> = {};
  if (templateType === 'parish_identity') {
    const slideLogoId = typeof c.logoMediaId === 'string' ? c.logoMediaId : null;
    const effectiveLogoId = slideLogoId ?? tenantLogoMediaId ?? null;
    if (effectiveLogoId) {
      const url = mediaMap.get(effectiveLogoId);
      if (url) resolved.logoUrl = url;
    }
  }
  if (typeof c.bgImageMediaId === 'string') {
    const url = mediaMap.get(c.bgImageMediaId);
    if (url) resolved.bgImageUrl = url;
  }
  if (typeof c.bgVideoMediaId === 'string') {
    const url = mediaMap.get(c.bgVideoMediaId);
    if (url) resolved.bgVideoUrl = url;
  }
  if (typeof c.phoneMockupMediaId === 'string') {
    const url = mediaMap.get(c.phoneMockupMediaId);
    if (url) resolved.phoneMockupUrl = url;
  }
  return resolved;
}

/**
 * Returned to the admin grid. `resolvedMedia` is per-orientation so the
 * card can preview either tab. Either side may be null when that
 * orientation is unauthored.
 */
export type SlideWithResolvedMedia = Awaited<ReturnType<typeof getSlidesByTenant>>[number] & {
  resolvedMedia: {
    portrait: Record<string, string> | null;
    landscape: Record<string, string> | null;
  };
};

export async function getSlidesByTenantWithMedia(tenantId: string): Promise<SlideWithResolvedMedia[]> {
  const list = await getSlidesByTenant(tenantId);
  const tenantSettings = await db.query.settings.findFirst({
    where: eq(settings.tenantId, tenantId),
  });

  const mediaIds = new Set<string>();
  if (tenantSettings?.logoMediaId) mediaIds.add(tenantSettings.logoMediaId);
  for (const s of list) {
    collectContentMediaIds(s.content, mediaIds);
    collectContentMediaIds(s.contentLandscape, mediaIds);
  }

  const mediaRows = mediaIds.size > 0
    ? await db.query.media.findMany({ where: (m, { inArray }) => inArray(m.id, Array.from(mediaIds)) })
    : [];
  const mediaMap = new Map(mediaRows.map((m) => [m.id, m.blobUrl]));
  const tenantLogoId = tenantSettings?.logoMediaId ?? null;

  return list.map((s) => ({
    ...s,
    resolvedMedia: {
      portrait: resolveContentMedia(s.content, s.templateType, tenantLogoId, mediaMap),
      landscape: resolveContentMedia(s.contentLandscape, s.templateType, tenantLogoId, mediaMap),
    },
  }));
}

export async function getDisplaysByTenant(tenantId: string) {
  return db.query.displays.findMany({
    where: eq(displays.tenantId, tenantId),
    orderBy: [desc(displays.createdAt)],
  });
}

export async function getDisplayById(id: string) {
  return db.query.displays.findFirst({
    where: eq(displays.id, id),
  });
}

export async function getSettingsByTenant(tenantId: string) {
  return db.query.settings.findFirst({
    where: eq(settings.tenantId, tenantId),
  });
}

export async function getMediaById(id: string) {
  return db.query.media.findFirst({
    where: eq(media.id, id),
  });
}

/**
 * List all media uploaded by a tenant, newest first. The library picker
 * groups image + logo together (both are picker-eligible for any
 * ImageUpload slot), so pass type='image-or-logo' to get both.
 */
export async function getMediaByTenant(
  tenantId: string,
  type?: 'image' | 'logo' | 'video' | 'image-or-logo',
) {
  return db.query.media.findMany({
    where: and(
      eq(media.tenantId, tenantId),
      type === 'image-or-logo'
        ? or(eq(media.type, 'image'), eq(media.type, 'logo'))
        : type
        ? eq(media.type, type)
        : undefined,
    ),
    orderBy: [desc(media.uploadedAt)],
  });
}

/**
 * Find every slide that references a media id in any of its content slots
 * (logoMediaId, bgImageMediaId, bgVideoMediaId, phoneMockupMediaId). Used
 * to block deletes that would orphan a slide, and to show the user which
 * slides need editing first.
 */
export async function getSlidesReferencingMedia(tenantId: string, mediaId: string) {
  const rows = await db.query.slides.findMany({
    where: eq(slides.tenantId, tenantId),
    columns: { id: true, title: true, content: true, templateType: true },
  });
  return rows.filter((s) => {
    const c = s.content as Record<string, unknown> | null;
    if (!c) return false;
    return (
      c.logoMediaId === mediaId ||
      c.bgImageMediaId === mediaId ||
      c.bgVideoMediaId === mediaId ||
      c.phoneMockupMediaId === mediaId
    );
  });
}

/**
 * Is this media row the tenant's default logo? (Different table from
 * slides — settings.logoMediaId is the parish-wide default.)
 */
export async function isMediaUsedBySettings(tenantId: string, mediaId: string) {
  const s = await getSettingsByTenant(tenantId);
  return s?.logoMediaId === mediaId;
}

export async function getSettingsWithMedia(tenantId: string) {
  const s = await getSettingsByTenant(tenantId);
  if (!s) return null;
  const logoMedia = s.logoMediaId ? await getMediaById(s.logoMediaId) : null;
  return { ...s, logoMedia };
}

export async function getTenantBySlug(slug: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });
}

export async function getDefaultTenant() {
  return db.query.tenants.findFirst();
}

export async function getRecentAuditLog(tenantId: string, limit = 100) {
  return db.query.auditLog.findMany({
    where: eq(auditLog.tenantId, tenantId),
    orderBy: [desc(auditLog.createdAt)],
    limit,
  });
}

export async function getCollectionsByTenant(tenantId: string) {
  return db.query.collections.findMany({
    where: eq(collections.tenantId, tenantId),
    orderBy: [asc(collections.displayOrder), asc(collections.createdAt)],
  });
}

export async function getRecentErrors(tenantId: string, limit = 100) {
  // Errors may have null tenantId (e.g. server-side errors fired before
  // tenant context is established); include those too so they're visible
  // in the only admin we have.
  return db.query.errors.findMany({
    where: or(eq(errors.tenantId, tenantId), isNull(errors.tenantId)),
    orderBy: [desc(errors.createdAt)],
    limit,
  });
}

export async function getSlideTitles(tenantId: string) {
  const rows = await db.query.slides.findMany({
    where: eq(slides.tenantId, tenantId),
    columns: { id: true, title: true, templateType: true },
  });
  return Object.fromEntries(rows.map((r) => [r.id, { title: r.title, templateType: r.templateType }]));
}
