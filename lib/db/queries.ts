import { eq, and, or, isNull, lte, gte, desc } from 'drizzle-orm';
import { db } from './client';
import { slides, displays, settings, tenants } from './schema';
import type { SlideWithContent } from './schema';

export async function getEligibleSlides(displayId: string): Promise<SlideWithContent[]> {
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

  return filtered as SlideWithContent[];
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

export async function getTenantBySlug(slug: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });
}

export async function getDefaultTenant() {
  return db.query.tenants.findFirst();
}
