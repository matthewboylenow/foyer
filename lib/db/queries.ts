import { eq, and, or, isNull, lte, gte, desc } from 'drizzle-orm';
import { db } from './client';
import { slides, displays, settings, tenants, auditLog } from './schema';
import type { SlideWithContent } from './schema';

export type EligibleSlide = SlideWithContent & {
  /** Resolved blob URLs for any media referenced by content (filled server-side) */
  resolvedMedia?: Record<string, string>;
};

export async function getEligibleSlides(displayId: string): Promise<EligibleSlide[]> {
  const display = await db.query.displays.findFirst({
    where: eq(displays.id, displayId),
  });
  if (!display || !display.active) return [];

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

  const filtered = eligible.filter((s) => {
    const targets = (s.targetDisplays as string[]) ?? [];
    return targets.length === 0 || targets.includes(displayId);
  });

  // Resolve media references — gather all media IDs, look them up, attach URLs.
  const tenantSettings = await db.query.settings.findFirst({
    where: eq(settings.tenantId, display.tenantId),
  });

  const mediaIds = new Set<string>();
  if (tenantSettings?.logoMediaId) mediaIds.add(tenantSettings.logoMediaId);
  for (const s of filtered) {
    const c = s.content as Record<string, unknown>;
    if (typeof c?.logoMediaId === 'string') mediaIds.add(c.logoMediaId);
    if (typeof c?.bgImageMediaId === 'string') mediaIds.add(c.bgImageMediaId);
    if (typeof c?.phoneMockupMediaId === 'string') mediaIds.add(c.phoneMockupMediaId);
  }

  const mediaRows = mediaIds.size > 0
    ? await db.query.media.findMany({ where: (m, { inArray }) => inArray(m.id, Array.from(mediaIds)) })
    : [];
  const mediaMap = new Map(mediaRows.map((m) => [m.id, m.blobUrl]));

  return filtered.map((s): EligibleSlide => {
    const c = s.content as Record<string, unknown>;
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
    if (typeof c?.phoneMockupMediaId === 'string') {
      const url = mediaMap.get(c.phoneMockupMediaId);
      if (url) resolved.phoneMockupUrl = url;
    }
    return { ...(s as SlideWithContent), resolvedMedia: resolved };
  });
}


export async function getSlidesByTenant(tenantId: string) {
  return db.query.slides.findMany({
    where: eq(slides.tenantId, tenantId),
    orderBy: [desc(slides.updatedAt)],
  });
}

export async function getSlideById(id: string) {
  return db.query.slides.findFirst({
    where: eq(slides.id, id),
  });
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
  const { media } = await import('./schema');
  return db.query.media.findFirst({
    where: eq(media.id, id),
  });
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

export async function getSlideTitles(tenantId: string) {
  const rows = await db.query.slides.findMany({
    where: eq(slides.tenantId, tenantId),
    columns: { id: true, title: true, templateType: true },
  });
  return Object.fromEntries(rows.map((r) => [r.id, { title: r.title, templateType: r.templateType }]));
}
