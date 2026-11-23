'use client';

import { useLayoutEffect, useState, type ReactNode } from 'react';
import type { SlideOrientation } from '@/lib/db/schema';

/** The design canvas every template is drawn on, in CSS pixels. */
export const CANVAS: Record<SlideOrientation, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
};

interface FitCanvasProps {
  orientation: SlideOrientation;
  children: ReactNode;
}

/**
 * Lays the slide out on its fixed design canvas and scales that canvas to
 * fit the real viewport, centred, keeping its aspect ratio.
 *
 * Templates size everything in absolute pixels for a 1080×1920 canvas. A
 * TV only honours that if its browser reports exactly that many CSS
 * pixels, and the Android WebViews in the kiosks do not: a 1080p panel at
 * device-pixel-ratio 2 is a 540×960 viewport, so unscaled text came out
 * twice the intended size and body copy was clipped. Scaling the whole
 * canvas (the same way the admin previews do) makes the output identical
 * on every device, and makes the admin preview a faithful picture of the
 * wall. The scale is measured before first paint, so nothing flashes at
 * the wrong size.
 */
export function FitCanvas({ orientation, children }: FitCanvasProps) {
  const { w, h } = CANVAS[orientation];
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => setScale(Math.min(window.innerWidth / w, window.innerHeight / h));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [w, h]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        data-canvas={orientation}
        data-scale={scale ?? undefined}
        className="absolute overflow-hidden"
        style={{
          width: w,
          height: h,
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${scale ?? 1})`,
          transformOrigin: 'center',
          visibility: scale === null ? 'hidden' : 'visible',
        }}
      >
        {children}
      </div>
    </div>
  );
}
