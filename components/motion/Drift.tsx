'use client';

import { motion } from 'motion/react';

interface DriftProps {
  children: React.ReactNode;
  /** Duration of one full cycle in ms (default 8s = slow, organic) */
  duration?: number;
  /** Vertical range in px (default 8 = subtle) */
  y?: number;
  /** Horizontal range in px (default 0) */
  x?: number;
  /** Scale variation (default 0 = no scale breathing) — try 0.01 for subtle breathing */
  scale?: number;
  className?: string;
}

/**
 * Continuous ambient motion — slow figure-8 / floating drift.
 * Use sparingly on hero elements that should feel alive during the hold phase.
 */
export function Drift({
  children,
  duration = 8000,
  y = 8,
  x = 0,
  scale = 0,
  className,
}: DriftProps) {
  const d = duration / 1000;
  return (
    <motion.div
      className={className}
      animate={{
        y: y ? [0, -y, 0, y, 0] : 0,
        x: x ? [0, x, 0, -x, 0] : 0,
        scale: scale ? [1, 1 + scale, 1, 1 - scale * 0.5, 1] : 1,
      }}
      transition={{
        duration: d,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
}
