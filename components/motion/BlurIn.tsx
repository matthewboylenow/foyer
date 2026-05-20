'use client';

import { motion } from 'motion/react';

const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface BlurInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  /** Accepted for API compat — filter-blur was removed because animating
   *  CSS filters destroys framerate on signage-class GPUs. */
  blur?: number;
  className?: string;
  as?: 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3';
}

// Cinematic entrance: fade up with a small rise. Filter-blur dropped for perf.
export function BlurIn({
  children,
  delay = 0,
  duration = 1200,
  y = 14,
  className,
  as = 'div',
}: BlurInProps) {
  const MotionEl = motion[as] as typeof motion.div;
  return (
    <MotionEl
      className={className}
      style={{ willChange: 'opacity, transform' }}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: duration / 1000,
        delay: delay / 1000,
        ease: EASING,
      }}
    >
      {children}
    </MotionEl>
  );
}
