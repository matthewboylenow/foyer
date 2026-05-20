'use client';

import { motion } from 'motion/react';

interface FilmGrainProps {
  opacity?: number;
  /** Speed of the noise shift in ms (default 1200) */
  duration?: number;
}

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E`;

/**
 * Subtle animated film-grain overlay. The position jitter at high speed
 * mimics actual film grain rather than the static texture we had before.
 * Keep opacity low — too much grain reads as cheap.
 */
export function FilmGrain({ opacity = 0.05, duration = 1200 }: FilmGrainProps) {
  return (
    <motion.div
      aria-hidden
      className="absolute inset-0 pointer-events-none z-50 mix-blend-overlay"
      style={{
        backgroundImage: `url("${NOISE_SVG}")`,
        backgroundSize: '300px 300px',
        opacity,
      }}
      animate={{
        backgroundPosition: [
          '0px 0px',
          '12px 8px',
          '-8px 14px',
          '14px -10px',
          '-12px -6px',
          '0px 0px',
        ],
      }}
      transition={{
        duration: duration / 1000,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}
