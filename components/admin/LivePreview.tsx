'use client';

import { useEffect, useState, useRef } from 'react';
import { templates } from '@/components/templates';
import type { TemplateKey } from '@/components/templates';
import type { SlideContent, SlideOrientation } from '@/lib/db/schema';

interface LivePreviewProps {
  templateType: TemplateKey;
  content: SlideContent;
  /** Which orientation to render. Portrait = 1080×1920, landscape = 1920×1080. */
  orientation?: SlideOrientation;
  logoUrl?: string | null;
  bgImageUrl?: string | null;
  bgVideoUrl?: string | null;
  phoneMockupUrl?: string | null;
  imageUrl?: string | null;
  /** Preview pixel width — height auto-scales to the orientation's aspect. */
  width?: number;
}

export function LivePreview({
  templateType,
  content,
  orientation = 'portrait',
  logoUrl,
  bgImageUrl,
  bgVideoUrl,
  phoneMockupUrl,
  imageUrl,
  width = 280,
}: LivePreviewProps) {
  // Debounce content changes so animations don't replay on every keystroke.
  // Bundle orientation into the debounce so a tab switch counts as a change.
  const [debouncedContent, setDebouncedContent] = useState(content);
  const [debouncedOrientation, setDebouncedOrientation] = useState(orientation);
  const [renderKey, setRenderKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedContent(content);
      setDebouncedOrientation(orientation);
      setRenderKey((k) => k + 1);
    }, 500);
    return () => clearTimeout(timerRef.current);
  }, [content, orientation]);

  const config = templates[templateType];
  if (!config) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = config.component as React.ComponentType<any>;

  // Native canvas dimensions per orientation.
  const NATIVE_W = debouncedOrientation === 'landscape' ? 1920 : 1080;
  const NATIVE_H = debouncedOrientation === 'landscape' ? 1080 : 1920;
  const scale = width / NATIVE_W;
  const height = NATIVE_H * scale;

  return (
    <div
      className="relative border border-border rounded-md overflow-hidden bg-black shadow-sm"
      style={{ width, height }}
    >
      <div
        key={renderKey}
        className="absolute top-0 left-0"
        style={{
          width: NATIVE_W,
          height: NATIVE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <Component
          content={debouncedContent}
          orientation={debouncedOrientation}
          logoUrl={logoUrl ?? undefined}
          bgImageUrl={bgImageUrl ?? undefined}
          bgVideoUrl={bgVideoUrl ?? undefined}
          phoneMockupUrl={phoneMockupUrl ?? undefined}
          imageUrl={imageUrl ?? undefined}
        />
      </div>
    </div>
  );
}
