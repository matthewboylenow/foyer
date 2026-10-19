import { Suspense } from 'react';
import { getCurrentTenant } from '@/lib/tenant';
import { getSlidesByTenantWithMedia, getCollectionsByTenant } from '@/lib/db/queries';
import { SlideGrid } from '@/components/admin/SlideGrid';
import { SlideGridSkeleton } from '@/components/admin/SlideGridSkeleton';
import { PublishBar } from '@/components/admin/PublishBar';

export default async function SlidesPage() {
  const tenant = await getCurrentTenant();
  const [slides, collections] = await Promise.all([
    tenant ? getSlidesByTenantWithMedia(tenant.id) : [],
    tenant ? getCollectionsByTenant(tenant.id) : [],
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-3xl font-bold text-navy leading-none">Slides</h1>
      </div>
      <div className="mb-6">
        <PublishBar />
      </div>
      <Suspense fallback={<SlideGridSkeleton />}>
        <SlideGrid slides={slides} collections={collections} />
      </Suspense>
    </div>
  );
}
