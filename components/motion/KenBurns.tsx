'use client';

import { motion } from 'motion/react';
import Image from 'next/image';

interface KenBurnsStart {
  scale: number;
  x?: number;
  y?: number;
}

interface KenBurnsProps {
  src: string;
  alt?: string;
  duration?: number;
  start?: KenBurnsStart;
  end?: KenBurnsStart;
  className?: string;
}

export function KenBurns({
  src,
  alt = '',
  duration = 20000,
  start = { scale: 1.0, x: 0, y: 0 },
  end = { scale: 1.08, x: -1, y: -1 },
  className,
}: KenBurnsProps) {
  return (
    <motion.div
      className={`absolute inset-0 overflow-hidden ${className ?? ''}`}
      initial={{ scale: start.scale, x: `${start.x ?? 0}%`, y: `${start.y ?? 0}%` }}
      animate={{ scale: end.scale, x: `${end.x ?? 0}%`, y: `${end.y ?? 0}%` }}
      transition={{
        duration: duration / 1000,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'linear',
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        priority
      />
    </motion.div>
  );
}
