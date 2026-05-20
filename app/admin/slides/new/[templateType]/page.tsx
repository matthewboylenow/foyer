import { notFound } from 'next/navigation';
import { templates } from '@/components/templates';
import { SlideEditor } from '@/components/admin/SlideEditor';
import { getDefaultTenant, getSettingsWithMedia } from '@/lib/db/queries';
import type { TemplateKey } from '@/components/templates';

export default async function NewSlideByTemplatePage({
  params,
}: {
  params: Promise<{ templateType: string }>;
}) {
  const { templateType } = await params;
  if (!(templateType in templates)) notFound();

  const tenant = await getDefaultTenant();
  const settings = tenant ? await getSettingsWithMedia(tenant.id) : null;
  const tenantLogoUrl = settings?.logoMedia?.blobUrl ?? null;

  return (
    <SlideEditor
      templateType={templateType as TemplateKey}
      initialSlide={null}
      tenantLogoUrl={tenantLogoUrl}
    />
  );
}
