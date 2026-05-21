/**
 * Cross-tenant queries used only by /super (operator views). These bypass
 * the tenant_id WHERE clause that every other query enforces, so they
 * MUST only be called from a super-admin-gated context.
 */
import { sql, desc, isNull, or, eq } from 'drizzle-orm';
import { db } from './client';
import {
  tenants,
  slides,
  displays,
  media,
  tenantUsers,
  errors,
  auditLog,
} from './schema';

export interface TenantOverviewRow {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  slideCount: number;
  activeSlideCount: number;
  displayCount: number;
  activeDisplayCount: number;
  userCount: number;
  mediaCount: number;
  errorCount24h: number;
  lastActivityAt: Date | null;
}

/**
 * One row per tenant with the aggregate counts an operator wants at a glance.
 * Built from a single DB round-trip via a CTE-style query so it scales fine
 * as tenants grow.
 */
export async function getTenantsOverview(): Promise<TenantOverviewRow[]> {
  const allTenants = await db.query.tenants.findMany({
    orderBy: [desc(tenants.createdAt)],
  });
  if (allTenants.length === 0) return [];

  // Parallel aggregate fetches — drizzle doesn't have a great cross-table
  // aggregation DSL, so we issue grouped counts and stitch in JS. Cheap
  // because each query is a single GROUP BY scan.
  const [
    slideCounts,
    activeSlideCounts,
    displayCounts,
    activeDisplayCounts,
    userCounts,
    mediaCounts,
    errorCounts,
    lastAudits,
  ] = await Promise.all([
    db
      .select({ tenantId: slides.tenantId, n: sql<number>`count(*)::int` })
      .from(slides)
      .groupBy(slides.tenantId),
    db
      .select({ tenantId: slides.tenantId, n: sql<number>`count(*)::int` })
      .from(slides)
      .where(eq(slides.active, true))
      .groupBy(slides.tenantId),
    db
      .select({ tenantId: displays.tenantId, n: sql<number>`count(*)::int` })
      .from(displays)
      .groupBy(displays.tenantId),
    db
      .select({ tenantId: displays.tenantId, n: sql<number>`count(*)::int` })
      .from(displays)
      .where(eq(displays.active, true))
      .groupBy(displays.tenantId),
    db
      .select({ tenantId: tenantUsers.tenantId, n: sql<number>`count(*)::int` })
      .from(tenantUsers)
      .groupBy(tenantUsers.tenantId),
    db
      .select({ tenantId: media.tenantId, n: sql<number>`count(*)::int` })
      .from(media)
      .groupBy(media.tenantId),
    db
      .select({ tenantId: errors.tenantId, n: sql<number>`count(*)::int` })
      .from(errors)
      .where(sql`${errors.createdAt} > now() - interval '24 hours'`)
      .groupBy(errors.tenantId),
    db
      .select({
        tenantId: auditLog.tenantId,
        ts: sql<Date>`max(${auditLog.createdAt})`,
      })
      .from(auditLog)
      .groupBy(auditLog.tenantId),
  ]);

  const map = <T extends { tenantId: string | null }>(rows: T[]) =>
    new Map(rows.filter((r) => r.tenantId).map((r) => [r.tenantId!, r]));

  const slideMap = map(slideCounts);
  const activeSlideMap = map(activeSlideCounts);
  const displayMap = map(displayCounts);
  const activeDisplayMap = map(activeDisplayCounts);
  const userMap = map(userCounts);
  const mediaMap = map(mediaCounts);
  const errorMap = map(errorCounts);
  const auditMap = map(lastAudits);

  return allTenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    createdAt: t.createdAt,
    slideCount: slideMap.get(t.id)?.n ?? 0,
    activeSlideCount: activeSlideMap.get(t.id)?.n ?? 0,
    displayCount: displayMap.get(t.id)?.n ?? 0,
    activeDisplayCount: activeDisplayMap.get(t.id)?.n ?? 0,
    userCount: userMap.get(t.id)?.n ?? 0,
    mediaCount: mediaMap.get(t.id)?.n ?? 0,
    errorCount24h: errorMap.get(t.id)?.n ?? 0,
    lastActivityAt: auditMap.get(t.id)?.ts ?? null,
  }));
}

/**
 * Every error across every tenant, newest first. Includes tenant name so
 * the operator UI can show "which parish" without a second lookup.
 *
 * Errors with a null tenant_id (system-level, before tenant context was
 * established) are also returned and labelled "(system)" in the UI.
 */
export async function getAllRecentErrors(limit = 500) {
  return db
    .select({
      id: errors.id,
      source: errors.source,
      message: errors.message,
      stack: errors.stack,
      context: errors.context,
      displayId: errors.displayId,
      slideId: errors.slideId,
      createdAt: errors.createdAt,
      tenantId: errors.tenantId,
      tenantName: tenants.name,
    })
    .from(errors)
    .leftJoin(tenants, eq(errors.tenantId, tenants.id))
    .where(or(isNull(errors.tenantId), eq(tenants.id, errors.tenantId)))
    .orderBy(desc(errors.createdAt))
    .limit(limit);
}
