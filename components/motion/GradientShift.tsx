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
    // Was animating `backgroundPosition` — forces full repaint each tick on
    // weak GPUs. Now translate an oversized gradient layer, which the
    // compositor can promote and accelerate.
    return (
      <div
        className={`absolute inset-0 overflow-hidden ${className ?? ''}`}
        style={{ background: c2 }}
      >
        <motion.div
          className="absolute"
          style={{
            inset: '-25%',
            background: `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c1} 100%)`,
            willChange: 'transform',
          }}
          initial={{ x: '-10%', y: '-10%' }}
          animate={{ x: ['-10%', '10%', '-10%'], y: ['-10%', '10%', '-10%'] }}
          transition={{
            duration: duration / 1000,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
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
