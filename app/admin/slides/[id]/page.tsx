import { notFound } from 'next/navigation';
import {
  getSlideById,
  getDefaultTenant,
  getSettingsWithMedia,
  getMediaById,
  getDisplaysByTenant,
  getCollectionsByTenant,
} from '@/lib/db/queries';
import { SlideEditor } from '@/components/admin/SlideEditor';
import type { TemplateKey } from '@/components/templates';
import type { SlideWithContent } from '@/lib/db/schema';

export default async function EditSlidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slide = await getSlideById(id);
  if (!slide) notFound();

  const tenant = await getDefaultTenant();
  const settings = tenant ? await getSettingsWithMedia(tenant.id) : null;
  const tenantLogoUrl = settings?.logoMedia?.blobUrl ?? null;
  const displays = tenant ? await getDisplaysByTenant(tenant.id) : [];
  const collections = tenant ? await getCollectionsByTenant(tenant.id) : [];

  const content = slide.content as Record<string, unknown>;
  const ids: Record<string, string | null> = {
    logo: typeof content?.logoMediaId === 'string' ? content.logoMediaId : null,
    bg: typeof content?.bgImageMediaId === 'string' ? content.bgImageMediaId : null,
    bgVideo: typeof content?.bgVideoMediaId === 'string' ? content.bgVideoMediaId : null,
    phone: typeof content?.phoneMockupMediaId === 'string' ? content.phoneMockupMediaId : null,
  };

  const resolved: Record<string, string | null> = { logo: null, bg: null, bgVideo: null, phone: null };
  for (const [k, mid] of Object.entries(ids)) {
    if (!mid) continue;
    const m = await getMediaById(mid);
    if (m) resolved[k] = m.blobUrl;
  }

  return (
    <SlideEditor
      templateType={slide.templateType as TemplateKey}
      initialSlide={slide as SlideWithContent}
      tenantLogoUrl={tenantLogoUrl}
      displays={displays.map((d) => ({ id: d.id, name: d.name }))}
      collections={collections}
      initialMedia={{
        logoUrl: resolved.logo,
        bgImageUrl: resolved.bg,
        bgVideoUrl: resolved.bgVideo,
        phoneMockupUrl: resolved.phone,
      }}
    />
  );
}
