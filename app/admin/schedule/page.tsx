import { getCurrentTenant } from '@/lib/tenant';
import { getSlidesByTenant, getCollectionsByTenant } from '@/lib/db/queries';
import { ScheduleTimeline } from '@/components/admin/ScheduleTimeline';
import type { Slide } from '@/lib/db/schema';

export default async function SchedulePage() {
  const tenant = await getCurrentTenant();
  const [slides, collections] = await Promise.all([
    tenant ? getSlidesByTenant(tenant.id) : [],
    tenant ? getCollectionsByTenant(tenant.id) : [],
  ]);

  // Serialize Date instances for the client component.
  const slideRows = (slides as Slide[]).map((s) => ({
    ...s,
    startAt: s.startAt ? new Date(s.startAt).toISOString() : null,
    endAt: s.endAt ? new Date(s.endAt).toISOString() : null,
    updatedAt: new Date(s.updatedAt).toISOString(),
    createdAt: new Date(s.createdAt).toISOString(),
  }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Schedule</h1>
      </div>
      <ScheduleTimeline slides={slideRows} collections={collections} />
    </div>
  );
}
