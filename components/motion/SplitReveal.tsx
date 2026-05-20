'use client';

import { motion } from 'motion/react';

const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface SplitRevealProps {
  text: string;
  delay?: number;
  duration?: number;
  className?: string;
}

export function SplitReveal({ text, delay = 0, duration = 1000, className }: SplitRevealProps) {
  const d = duration / 1000;
  const delayS = delay / 1000;

  return (
    <span className={`${className ?? ''} relative inline-block`} aria-label={text}>
      {/* Hidden text to take up layout space */}
      <span className="invisible">{text}</span>

      {/* Top half — clips to upper portion and slides up */}
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: 'inset(0 0 50% 0)' }}
        aria-hidden
      >
        <motion.span
          className="absolute inset-0 flex items-end"
          initial={{ y: '0%' }}
          animate={{ y: '-100%' }}
          transition={{ duration: d, delay: delayS, ease: EASING }}
        >
          {text}
        </motion.span>
      </span>

      {/* Bottom half — clips to lower portion and slides down */}
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: 'inset(50% 0 0 0)' }}
        aria-hidden
      >
        <motion.span
          className="absolute inset-0 flex items-start"
          initial={{ y: '0%' }}
          animate={{ y: '100%' }}
          transition={{ duration: d, delay: delayS, ease: EASING }}
        >
          {text}
        </motion.span>
      </span>

      {/* Final text reveals from opacity 0 as halves depart */}
      <motion.span
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: d * 0.5, delay: delayS + d * 0.3, ease: 'easeOut' }}
        aria-hidden
      >
        {text}
      </motion.span>
    </span>
  );
}
