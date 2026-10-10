import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { slides } from '@/lib/db/schema';
import type { Slide } from '@/lib/db/schema';
import { getCurrentTenant } from '@/lib/tenant';
import { getMediaById } from '@/lib/db/queries';
import { WeeklyParishForm } from '@/components/admin/WeeklyParishForm';

export const dynamic = 'force-dynamic';

async function pick(tenantId: string, templateType: 'mass_schedule' | 'weekly_association' | 'sanctuary_candle') {
  // The active one if there is one, else the most recently edited.
  const rows = await db.query.slides.findMany({
    where: and(eq(slides.tenantId, tenantId), eq(slides.templateType, templateType)),
    orderBy: [desc(slides.active), desc(slides.updatedAt)],
    limit: 1,
  });
  return rows[0] ?? null;
}

async function bgUrl(s: Slide | null): Promise<string | null> {
  const id = (s?.content as { bgImageMediaId?: string } | null)?.bgImageMediaId;
  if (!id) return null;
  return (await getMediaById(id))?.blobUrl ?? null;
}

export default async function WeeklyPage() {
  const tenant = await getCurrentTenant();
  const [intentions, association, candle] = tenant
    ? await Promise.all([
        pick(tenant.id, 'mass_schedule'),
        pick(tenant.id, 'weekly_association'),
        pick(tenant.id, 'sanctuary_candle'),
      ])
    : [null, null, null];
  const [mi, ma, mc] = await Promise.all([bgUrl(intentions), bgUrl(association), bgUrl(candle)]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">This week</h1>
        <p className="mt-2 text-sm text-navy/55">
          The three parish slides in one place. Paste from the bulletin, check the previews,
          press one button.
        </p>
      </div>
      <WeeklyParishForm
        slides={{ intentions, association, candle }}
        media={{ intentions: mi, association: ma, candle: mc }}
      />
    </div>
  );
}
