'use client';

import { motion } from 'motion/react';

const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface LineMaskProps {
  text: string;
  delay?: number;
  duration?: number;
  direction?: 'ltr' | 'rtl';
  className?: string;
}

export function LineMask({
  text,
  delay = 0,
  duration = 900,
  className,
}: LineMaskProps) {
  return (
    <span className={`${className ?? ''} inline-block overflow-hidden`} aria-label={text}>
      <motion.span
        className="inline-block"
        initial={{ y: '100%' }}
        animate={{ y: '0%' }}
        transition={{
          duration: duration / 1000,
          delay: delay / 1000,
          ease: EASING,
        }}
      >
        {text}
      </motion.span>
    </span>
  );
}
