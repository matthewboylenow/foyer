import { notFound } from 'next/navigation';
import { templates } from '@/components/templates';
import { SlideEditor } from '@/components/admin/SlideEditor';
import type { TemplateKey } from '@/components/templates';

export default async function NewSlideByTemplatePage({
  params,
}: {
  params: Promise<{ templateType: string }>;
}) {
  const { templateType } = await params;

  if (!(templateType in templates)) notFound();

  return (
    <SlideEditor
      templateType={templateType as TemplateKey}
      initialSlide={null}
    />
  );
}
