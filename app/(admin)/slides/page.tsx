import { Suspense } from 'react';
import Link from 'next/link';
import { getDefaultTenant, getSlidesByTenant } from '@/lib/db/queries';
import { SlideList } from '@/components/admin/SlideList';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default async function SlidesPage() {
  const tenant = await getDefaultTenant();
  const slides = tenant ? await getSlidesByTenant(tenant.id) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-serif font-bold text-navy">Slides</h1>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Link href={'/admin/slides/new' as any} className={cn(buttonVariants(), 'bg-rust hover:bg-rust-700 text-cream')}>
          + New slide
        </Link>
      </div>
      <Suspense fallback={<div className="text-muted-foreground">Loading…</div>}>
        <SlideList slides={slides} />
      </Suspense>
    </div>
  );
}
