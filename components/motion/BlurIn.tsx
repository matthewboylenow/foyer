'use client';

import { motion } from 'motion/react';

// Soft expo-out — same curve as the other entrance primitives
const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface BlurInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  blur?: number;
  className?: string;
  as?: 'div' | 'span' | 'p' | 'h1' | 'h2' | 'h3';
}

/**
 * Cinematic text/element entrance: fades from blurred + slight drop.
 * The combo of opacity + blur + translateY reads as "focus pulling in" —
 * which is what makes it feel After Effects-grade vs a flat fade.
 */
export function BlurIn({
  children,
  delay = 0,
  duration = 1200,
  y = 14,
  blur = 12,
  className,
  as = 'div',
}: BlurInProps) {
  const MotionEl = motion[as] as typeof motion.div;
  return (
    <MotionEl
      className={className}
      initial={{ opacity: 0, y, filter: `blur(${blur}px)` }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
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
