'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const EXIT_EASING: [number, number, number, number] = [0.7, 0, 0.84, 0];

interface SlideFrameProps {
  children: React.ReactNode;
  slideId: string;
  holdMs: number;
  enterMs?: number;
  exitMs?: number;
  onDone: () => void;
}

export function SlideFrame({
  children,
  slideId,
  holdMs,
  enterMs = 1200,
  exitMs = 500,
  onDone,
}: SlideFrameProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    // Wait for entrance to complete, then hold, then signal done
    const totalMs = enterMs + holdMs;
    const timer = setTimeout(() => onDoneRef.current(), totalMs);
    return () => clearTimeout(timer);
  }, [slideId, enterMs, holdMs]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideId}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: enterMs / 1000, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
