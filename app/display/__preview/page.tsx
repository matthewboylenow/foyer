import { notFound } from 'next/navigation';
import { getCurrentTenant } from '@/lib/tenant';
import { getSlideById, getSettingsWithMedia, getMediaById } from '@/lib/db/queries';
import { templates } from '@/components/templates';
import { TenantTheme } from '@/components/TenantTheme';
import type { SlideWithContent } from '@/lib/db/schema';

// Preview must always reflect the latest saved slide — no CDN caching.
export const dynamic = 'force-dynamic';

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ slideId?: string; orientation?: string }>;
}) {
  const { slideId, orientation: orientationParam } = await searchParams;
  if (!slideId) notFound();

  const slide = await getSlideById(slideId);
  if (!slide) notFound();

  const templateConfig = templates[slide.templateType];
  if (!templateConfig) notFound();

  // Pick orientation from query string; default portrait. The editor's
  // "Full size ↗" link passes `&orientation=landscape` for the landscape tab.
  const orientation: 'portrait' | 'landscape' =
    orientationParam === 'landscape' ? 'landscape' : 'portrait';

  // Resolve media URLs so the preview matches what the player will show.
  const tenant = await getCurrentTenant();
  const settings = tenant ? await getSettingsWithMedia(tenant.id) : null;
  const tenantLogoUrl = settings?.logoMedia?.blobUrl ?? null;

  // Pick the orientation-resolved content slot. If the requested orientation
  // isn't authored, fall back to the other side so previewing always shows
  // *something* rather than a blank canvas.
  const portraitContent = slide.content as Record<string, unknown>;
  const landscapeContent = slide.contentLandscape as Record<string, unknown> | null;
  const portraitAuthored = portraitContent && Object.keys(portraitContent).length > 0;
  const landscapeAuthored = landscapeContent && Object.keys(landscapeContent).length > 0;

  let effectiveContent: Record<string, unknown> | null = null;
  if (orientation === 'landscape') {
    effectiveContent = landscapeAuthored
      ? landscapeContent
      : portraitAuthored
        ? portraitContent
        : null;
  } else {
    effectiveContent = portraitAuthored
      ? portraitContent
      : landscapeAuthored
        ? landscapeContent
        : null;
  }
  if (!effectiveContent) notFound();

  let logoUrl: string | null = null;
  let bgImageUrl: string | null = null;
  let bgVideoUrl: string | null = null;
  let phoneMockupUrl: string | null = null;

  if (slide.templateType === 'parish_identity') {
    const slideLogoId =
      typeof effectiveContent.logoMediaId === 'string' ? effectiveContent.logoMediaId : null;
    if (slideLogoId) {
      const m = await getMediaById(slideLogoId);
      logoUrl = m?.blobUrl ?? null;
    } else {
      logoUrl = tenantLogoUrl;
    }
  }
  if (typeof effectiveContent.bgImageMediaId === 'string') {
    const m = await getMediaById(effectiveContent.bgImageMediaId);
    bgImageUrl = m?.blobUrl ?? null;
  }
  if (typeof effectiveContent.bgVideoMediaId === 'string') {
    const m = await getMediaById(effectiveContent.bgVideoMediaId);
    bgVideoUrl = m?.blobUrl ?? null;
  }
  if (typeof effectiveContent.phoneMockupMediaId === 'string') {
    const m = await getMediaById(effectiveContent.phoneMockupMediaId);
    phoneMockupUrl = m?.blobUrl ?? null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SlideComponent = templateConfig.component as React.ComponentType<any>;

  return (
    <TenantTheme>
      <div className="fixed inset-0 bg-black overflow-hidden">
        <SlideComponent
          content={effectiveContent as SlideWithContent['content']}
          orientation={orientation}
          logoUrl={logoUrl ?? undefined}
          bgImageUrl={bgImageUrl ?? undefined}
          bgVideoUrl={bgVideoUrl ?? undefined}
          bgVideoAutoPlay
          phoneMockupUrl={phoneMockupUrl ?? undefined}
        />
      </div>
    </TenantTheme>
  );
}
