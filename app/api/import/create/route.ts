import { and, desc, eq, inArray, like } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { collections, slides } from '@/lib/db/schema';
import type { GeneralContent } from '@/lib/db/schema';
import { auth } from '@/lib/auth/config';
import { logAudit } from '@/lib/auth/session';
import { getCurrentTenant } from '@/lib/tenant';
import { itemToBodyHtml, IMPORT_COLLECTION_PREFIX } from '@/lib/import/parse-email';

interface CreateItem {
  heading: string;
  subtitle: string;
  paragraphs: string[];
  cta: string;
  ctaUrl: string;
  eventDate: string;
  expireAfterEvent: boolean;
}

interface CreateBody {
  items?: CreateItem[];
  collectionName?: string;
  deactivatePrevious?: boolean;
  activate?: boolean;
}

function dayAfterMorning(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  // 6 AM Eastern the morning after. Built as a UTC instant from local parts:
  // EDT is UTC-4, EST is UTC-5 — use 10:00Z which is 6 AM EDT / 5 AM EST.
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1, 10, 0, 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * POST /api/import/create
 *
 * Creates one General slide per item inside a new collection, optionally
 * deactivating every slide from earlier "Email blast" collections so the
 * screens roll over to this week's set in one step.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session && process.env.AUTH_DEV_BYPASS !== '1') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenant = await getCurrentTenant();
  if (!tenant) return Response.json({ error: 'No tenant' }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const items = (body.items ?? []).filter((i) => i && typeof i.heading === 'string' && i.heading.trim());
  if (items.length === 0) return Response.json({ error: 'No slides to create.' }, { status: 400 });

  const by = session?.user?.email ?? null;
  const now = new Date();
  const collectionName =
    (typeof body.collectionName === 'string' && body.collectionName.trim()) ||
    `${IMPORT_COLLECTION_PREFIX}${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}`;
  const activate = body.activate !== false;

  // 1. Retire the previous import(s).
  let deactivated = 0;
  if (body.deactivatePrevious) {
    const previous = await db.query.collections.findMany({
      where: and(eq(collections.tenantId, tenant.id), like(collections.name, `${IMPORT_COLLECTION_PREFIX}%`)),
    });
    const ids = previous.map((c) => c.id);
    if (ids.length > 0) {
      const rows = await db
        .update(slides)
        .set({ active: false, updatedAt: now, updatedBy: by })
        .where(and(eq(slides.tenantId, tenant.id), inArray(slides.collectionId, ids), eq(slides.active, true)))
        .returning({ id: slides.id });
      deactivated = rows.length;
    }
  }

  // 2. New collection at the end of the list.
  const [last] = await db.query.collections.findMany({
    where: eq(collections.tenantId, tenant.id),
    orderBy: [desc(collections.displayOrder)],
    limit: 1,
  });
  const [collection] = await db
    .insert(collections)
    .values({
      tenantId: tenant.id,
      name: collectionName,
      color: 'gold',
      displayOrder: (last?.displayOrder ?? 0) + 10,
    })
    .returning();

  // 3. One General slide per item.
  const created = await db
    .insert(slides)
    .values(
      items.map((item, i) => {
        const content: GeneralContent = {
          templateType: 'general',
          headline: item.heading.trim(),
          headlineSize: 'small',
          meta: (item.subtitle ?? '').trim(),
          body: itemToBodyHtml(item),
          eventDate: /^\d{4}-\d{2}-\d{2}$/.test(item.eventDate ?? '') ? item.eventDate : undefined,
          qrUrl: (item.ctaUrl ?? '').trim() || undefined,
          qrLabel: (item.ctaUrl ?? '').trim() ? 'Scan to visit' : undefined,
          motionStyle: 'lineMask',
          textMode: 'dark',
        };
        const endAt = item.expireAfterEvent && content.eventDate ? dayAfterMorning(content.eventDate) : null;
        return {
          tenantId: tenant.id,
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
    tenantId: tenant.id,
    userId: session?.user?.id,
    userEmail: by ?? undefined,
    action: 'import.email',
    targetType: 'collection',
    targetId: collection.id,
    metadata: { collection: collectionName, created: created.length, deactivated },
  });

  return Response.json(
    { ok: true, collectionId: collection.id, collectionName, created: created.length, deactivated },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
