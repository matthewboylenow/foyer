import { notFound } from 'next/navigation';
import { getSlideById } from '@/lib/db/queries';
import { templates } from '@/components/templates';
import type { SlideWithContent } from '@/lib/db/schema';

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

  const SlideComponent = templateConfig.component as React.ComponentType<{
    content: SlideWithContent['content'];
  }>;

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      <SlideComponent content={slide.content as SlideWithContent['content']} />
    </div>
  );
}
