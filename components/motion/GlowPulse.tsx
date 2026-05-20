'use client';

import { motion } from 'motion/react';

interface GlowPulseProps {
  /** CSS color, e.g. 'rgba(212,175,55,0.18)' */
  color?: string;
  /** Glow size in px (radius) — default 600 */
  size?: number;
  /** Position as CSS units, default centered */
  x?: string;
  y?: string;
  /** Breathing cycle in ms */
  duration?: number;
  className?: string;
}

/**
 * Slow radial glow that breathes — adds depth to dark slides without
 * pulling attention. The pulse range is small so it never reads as flashy.
 */
export function GlowPulse({
  color = 'rgba(212,175,55,0.18)',
  size = 600,
  x = '50%',
  y = '50%',
  duration = 6000,
  className,
}: GlowPulseProps) {
  return (
    <motion.div
      aria-hidden
      className={`absolute inset-0 pointer-events-none ${className ?? ''}`}
      style={{
        background: `radial-gradient(ellipse ${size}px ${size * 1.2}px at ${x} ${y}, ${color} 0%, transparent 70%)`,
      }}
      animate={{ opacity: [0.7, 1, 0.85, 1, 0.7] }}
      transition={{
        duration: duration / 1000,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}
