'use client';

import { KenBurns } from '@/components/motion/KenBurns';

interface BgLayerProps {
  bgImageUrl?: string;
  /** CSS background for the tint overlay rendered above the image. */
  tint: string;
  /** Optional CSS background for an ambient warm accent when no bg image. */
  ambient?: string;
}

/**
 * Shared bg renderer: ken-burns image + tint, falling back to an ambient
 * accent layer when no image is set. Lives below the template's content
 * (z-0 / no z-index) — caller is responsible for putting content above it.
 */
export function BgLayer({ bgImageUrl, tint, ambient }: BgLayerProps) {
  if (bgImageUrl) {
    return (
      <>
        <KenBurns src={bgImageUrl} duration={28000} />
        <div className="absolute inset-0" style={{ background: tint }} />
      </>
    );
  }
  if (ambient) {
    return <div className="absolute inset-0" style={{ background: ambient }} />;
  }
  return null;
}
