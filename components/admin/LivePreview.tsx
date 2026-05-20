'use client';

import { useEffect, useState, useRef } from 'react';
import { templates } from '@/components/templates';
import type { TemplateKey } from '@/components/templates';
import type { SlideContent } from '@/lib/db/schema';

interface LivePreviewProps {
  templateType: TemplateKey;
  content: SlideContent;
  logoUrl?: string | null;
  bgImageUrl?: string | null;
  phoneMockupUrl?: string | null;
  /** Preview pixel width (height auto-scales to 16:9 vertical = 1080×1920) */
  width?: number;
}

export function LivePreview({
  templateType,
  content,
  logoUrl,
  bgImageUrl,
  phoneMockupUrl,
  width = 280,
}: LivePreviewProps) {
  // Debounce content changes so animations don't replay on every keystroke
  const [debouncedContent, setDebouncedContent] = useState(content);
  const [renderKey, setRenderKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedContent(content);
      setRenderKey((k) => k + 1);
    }, 500);
    return () => clearTimeout(timerRef.current);
  }, [content]);

  const config = templates[templateType];
  if (!config) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = config.component as React.ComponentType<any>;

  // The templates are designed for 1080×1920 — scale to the preview width
  const NATIVE_W = 1080;
  const NATIVE_H = 1920;
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
          logoUrl={logoUrl ?? undefined}
          bgImageUrl={bgImageUrl ?? undefined}
          phoneMockupUrl={phoneMockupUrl ?? undefined}
        />
      </div>
    </div>
  );
}
