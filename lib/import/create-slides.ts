import { and, desc, eq, inArray, like } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { collections, slides } from '@/lib/db/schema';
import type { GeneralContent } from '@/lib/db/schema';
import { logAudit } from '@/lib/auth/session';
import { itemToBodyHtml, IMPORT_COLLECTION_PREFIX } from '@/lib/import/parse-email';
import { publishPlaylist } from '@/lib/publish';

/**
 * The second half of the email import, shared by the admin page
 * (POST /api/import/create) and the MCP `create_email_slides` tool: one
 * General slide per reviewed item inside a new "Email blast · <date>"
 * collection, optionally turning off the previous email's slides and
 * publishing.
 */

export interface CreateItem {
  heading: string;
  subtitle?: string;
  paragraphs?: string[];
  cta?: string;
  ctaUrl?: string;
  eventDate?: string;
  expireAfterEvent?: boolean;
}

export interface CreateOptions {
  items: CreateItem[];
  collectionName?: string;
  deactivatePrevious?: boolean;
  activate?: boolean;
  publish?: boolean;
}

export interface CreateResult {
  collectionId: string;
  collectionName: string;
  created: { id: string; title: string }[];
  deactivated: number;
  published: boolean;
}

function dayAfterMorning(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  // 6 AM Eastern the morning after. Built as a UTC instant from local parts:
  // EDT is UTC-4, EST is UTC-5 — use 10:00Z which is 6 AM EDT / 5 AM EST.
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1, 10, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function defaultImportCollectionName(now = new Date()): string {
  return `${IMPORT_COLLECTION_PREFIX}${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}`;
}

export async function createEmailSlides(
  tenantId: string,
  opts: CreateOptions,
  actor: { userId?: string; email?: string | null; label: string },
  auditAction = 'import.email',
): Promise<CreateResult> {
  const items = opts.items.filter((i) => i && typeof i.heading === 'string' && i.heading.trim());
  if (items.length === 0) throw new Error('No slides to create.');

  const by = actor.email ?? actor.label;
  const now = new Date();
  const collectionName = opts.collectionName?.trim() || defaultImportCollectionName(now);
  const activate = opts.activate !== false;

  // 1. Retire the previous import(s).
  let deactivated = 0;
  if (opts.deactivatePrevious) {
    const previous = await db.query.collections.findMany({
      where: and(eq(collections.tenantId, tenantId), like(collections.name, `${IMPORT_COLLECTION_PREFIX}%`)),
    });
    const ids = previous.map((c) => c.id);
    if (ids.length > 0) {
      const rows = await db
        .update(slides)
        .set({ active: false, updatedAt: now, updatedBy: by })
        .where(and(eq(slides.tenantId, tenantId), inArray(slides.collectionId, ids), eq(slides.active, true)))
        .returning({ id: slides.id });
      deactivated = rows.length;
    }
  }

  // 2. New collection at the end of the list.
  const [last] = await db.query.collections.findMany({
    where: eq(collections.tenantId, tenantId),
    orderBy: [desc(collections.displayOrder)],
    limit: 1,
  });
  const [collection] = await db
    .insert(collections)
    .values({ tenantId, name: collectionName, color: 'gold', displayOrder: (last?.displayOrder ?? 0) + 10 })
    .returning();

  // 3. One General slide per item.
  const created = await db
    .insert(slides)
    .values(
      items.map((item, i) => {
        const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(item.eventDate ?? '') ? item.eventDate : undefined;
        const content: GeneralContent = {
          templateType: 'general',
          headline: item.heading.trim(),
          headlineSize: 'small',
          meta: (item.subtitle ?? '').trim(),
          body: itemToBodyHtml({ paragraphs: item.paragraphs ?? [], cta: item.cta ?? '' }),
          eventDate,
          qrUrl: (item.ctaUrl ?? '').trim() || undefined,
          qrLabel: (item.ctaUrl ?? '').trim() ? 'Scan to visit' : undefined,
          motionStyle: 'lineMask',
          textMode: 'dark',
        };
        const endAt = item.expireAfterEvent !== false && eventDate ? dayAfterMorning(eventDate) : null;
        return {
          tenantId,
          templateType: 'general' as const,
          title: item.heading.trim().slice(0, 120),
          content,
          contentLandscape: null,
          scheduleType: endAt ? ('dated' as const) : ('evergreen' as const),
          startAt: null,
          endAt,
          active: activate,
          priority: false,
          weight: 1,
          durationOverrideSec: null,
          collectionId: collection.id,
          targetDisplays: [],
          displayOrder: (i + 1) * 10,
          createdBy: by,
          updatedBy: by,
        };
      }),
    )
    .returning({ id: slides.id, title: slides.title });

  await logAudit({
    tenantId,
    userId: actor.userId ?? actor.label,
    userEmail: actor.email ?? undefined,
    action: auditAction,
    targetType: 'collection',
    targetId: collection.id,
    metadata: { collection: collectionName, created: created.length, deactivated },
  });

  let published = false;
  if (opts.publish) {
    await publishPlaylist(tenantId, by, 'import');
    published = true;
  }

  return { collectionId: collection.id, collectionName, created, deactivated, published };
}
