import { notFound } from 'next/navigation';
import { getCurrentTenant } from '@/lib/tenant';
import { getSlideById, getSettingsWithMedia, getMediaById, getDisplaysByTenant, getCollectionsByTenant } from '@/lib/db/queries';
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

  const tenant = await getCurrentTenant();
  const settings = tenant ? await getSettingsWithMedia(tenant.id) : null;
  const tenantLogoUrl = settings?.logoMedia?.blobUrl ?? null;
  const displays = tenant ? await getDisplaysByTenant(tenant.id) : [];
  const collections = tenant ? await getCollectionsByTenant(tenant.id) : [];

  async function resolveContentMedia(content: unknown) {
    const c = (content ?? {}) as Record<string, unknown>;
    const ids: Record<'logo' | 'bg' | 'bgVideo' | 'phone', string | null> = {
      logo: typeof c.logoMediaId === 'string' ? c.logoMediaId : null,
      bg: typeof c.bgImageMediaId === 'string' ? c.bgImageMediaId : null,
      bgVideo: typeof c.bgVideoMediaId === 'string' ? c.bgVideoMediaId : null,
      phone: typeof c.phoneMockupMediaId === 'string' ? c.phoneMockupMediaId : null,
    };
    const out: {
      logoUrl: string | null;
      bgImageUrl: string | null;
      bgVideoUrl: string | null;
      bgVideoPosterUrl: string | null;
      phoneMockupUrl: string | null;
    } = {
      logoUrl: null,
      bgImageUrl: null,
      bgVideoUrl: null,
      bgVideoPosterUrl: null,
      phoneMockupUrl: null,
    };
    if (ids.logo) out.logoUrl = (await getMediaById(ids.logo))?.blobUrl ?? null;
    if (ids.bg) out.bgImageUrl = (await getMediaById(ids.bg))?.blobUrl ?? null;
    if (ids.bgVideo) {
      const v = await getMediaById(ids.bgVideo);
      out.bgVideoUrl = v?.blobUrl ?? null;
      out.bgVideoPosterUrl = v?.posterUrl ?? null;
    }
    if (ids.phone) out.phoneMockupUrl = (await getMediaById(ids.phone))?.blobUrl ?? null;
    return out;
  }

  const portraitMedia = await resolveContentMedia(slide.content);
  const landscapeMedia = await resolveContentMedia(slide.contentLandscape);

  return (
    <SlideEditor
      templateType={slide.templateType as TemplateKey}
      initialSlide={slide as SlideWithContent}
      tenantLogoUrl={tenantLogoUrl}
      displays={displays.map((d) => ({ id: d.id, name: d.name }))}
      collections={collections}
      initialMedia={{ portrait: portraitMedia, landscape: landscapeMedia }}
    />
  );
}
