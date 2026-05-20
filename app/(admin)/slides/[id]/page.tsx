import { notFound } from 'next/navigation';
import { getSlideById } from '@/lib/db/queries';
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

  return (
    <SlideEditor
      templateType={slide.templateType as TemplateKey}
      initialSlide={slide as SlideWithContent}
    />
  );
}
