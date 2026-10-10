import { notFound } from 'next/navigation';
import { templates } from '@/components/templates';
import { SlideEditor } from '@/components/admin/SlideEditor';
import { getCurrentTenant } from '@/lib/tenant';
import { getSettingsWithMedia, getDisplaysByTenant, getCollectionsByTenant } from '@/lib/db/queries';
import type { TemplateKey } from '@/components/templates';

export default async function NewSlideByTemplatePage({
  params,
}: {
  params: Promise<{ templateType: string }>;
}) {
  const { templateType } = await params;
  if (!(templateType in templates)) notFound();

  const tenant = await getCurrentTenant();
  const settings = tenant ? await getSettingsWithMedia(tenant.id) : null;
  const tenantLogoUrl = settings?.logoMedia?.blobUrl ?? null;
  const displays = tenant ? await getDisplaysByTenant(tenant.id) : [];
  const collections = tenant ? await getCollectionsByTenant(tenant.id) : [];

  return (
    <SlideEditor
      templateType={templateType as TemplateKey}
      initialSlide={null}
      tenantLogoUrl={tenantLogoUrl}
      displays={displays.map((d) => ({ id: d.id, name: d.name, orientation: d.orientation }))}
      collections={collections}
    />
  );
}
