'use client';

import { motion } from 'motion/react';

interface GradientShiftProps {
  colors: [string, string];
  duration?: number;
  pattern?: 'rotate' | 'shift' | 'pulse';
  className?: string;
}

export function GradientShift({
  colors,
  duration = 20000,
  pattern = 'rotate',
  className,
}: GradientShiftProps) {
  const [c1, c2] = colors;

  if (pattern === 'pulse') {
    return (
      <motion.div
        className={`absolute inset-0 ${className ?? ''}`}
        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        animate={{ opacity: [1, 0.92, 1] }}
        transition={{
          duration: duration / 1000,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    );
  }

  if (pattern === 'shift') {
    return (
      <motion.div
        className={`absolute inset-0 ${className ?? ''}`}
        style={{
          background: `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c1} 100%)`,
          backgroundSize: '200% 200%',
        }}
        animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
        transition={{
          duration: duration / 1000,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    );
  }

  // 'rotate' — animate gradient angle via inline style
  return (
    <motion.div
      className={`absolute inset-0 ${className ?? ''}`}
      animate={{}}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{
          duration: duration / 1000,
          repeat: Infinity,
          ease: 'linear',
        }}
        style={{
          background: `conic-gradient(from 0deg, ${c1}, ${c2}, ${c1})`,
          scale: 2,
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at center, ${c1}cc 0%, ${c2} 100%)` }}
      />
    </motion.div>
  );
}
