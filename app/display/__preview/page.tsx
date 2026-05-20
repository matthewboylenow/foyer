import { notFound } from 'next/navigation';
import {
  getSlideById,
  getDefaultTenant,
  getSettingsWithMedia,
  getMediaById,
} from '@/lib/db/queries';
import { templates } from '@/components/templates';
import type { SlideWithContent } from '@/lib/db/schema';

// Preview must always reflect the latest saved slide — no CDN caching.
export const dynamic = 'force-dynamic';

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ slideId?: string }>;
}) {
  const { slideId } = await searchParams;
  if (!slideId) notFound();

  const slide = await getSlideById(slideId);
  if (!slide) notFound();

  const templateConfig = templates[slide.templateType];
  if (!templateConfig) notFound();

  // Resolve media URLs so the preview matches what the player will show.
  const tenant = await getDefaultTenant();
  const settings = tenant ? await getSettingsWithMedia(tenant.id) : null;
  const tenantLogoUrl = settings?.logoMedia?.blobUrl ?? null;

  const content = slide.content as Record<string, unknown>;
  let logoUrl: string | null = null;
  let bgImageUrl: string | null = null;
  let phoneMockupUrl: string | null = null;

  if (slide.templateType === 'parish_identity') {
    const slideLogoId = typeof content?.logoMediaId === 'string' ? content.logoMediaId : null;
    if (slideLogoId) {
      const m = await getMediaById(slideLogoId);
      logoUrl = m?.blobUrl ?? null;
    } else {
      logoUrl = tenantLogoUrl;
    }
  }
  if (typeof content?.bgImageMediaId === 'string') {
    const m = await getMediaById(content.bgImageMediaId);
    bgImageUrl = m?.blobUrl ?? null;
  }
  if (typeof content?.phoneMockupMediaId === 'string') {
    const m = await getMediaById(content.phoneMockupMediaId);
    phoneMockupUrl = m?.blobUrl ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SlideComponent = templateConfig.component as React.ComponentType<any>;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <SlideComponent
        content={slide.content as SlideWithContent['content']}
        logoUrl={logoUrl ?? undefined}
        bgImageUrl={bgImageUrl ?? undefined}
        phoneMockupUrl={phoneMockupUrl ?? undefined}
      />
    </div>
  );
}
