'use client';

import { motion } from 'motion/react';

const EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface WordStaggerProps {
  text: string;
  delay?: number;
  staggerMs?: number;
  className?: string;
}

export function WordStagger({ text, delay = 0, staggerMs = 80, className }: WordStaggerProps) {
  const words = text.split(' ').filter(Boolean);

  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: delay / 1000 + (i * staggerMs) / 1000,
            ease: EASING,
          }}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  );
}
