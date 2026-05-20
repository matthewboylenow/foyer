'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const ENTER_EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface SlideFrameProps {
  children: React.ReactNode;
  slideId: string;
  holdMs: number;
  enterMs?: number;
  exitMs?: number;
  onDone: () => void;
}

// Cross-dissolve with a small inbound scale. Filter-blur was removed because
// animating CSS filters tanks framerate on the low-power GPUs in signage
// hardware (OptiSigns sticks / Samsung Tizen browsers).
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
    const totalMs = enterMs + holdMs;
    const timer = setTimeout(() => onDoneRef.current(), totalMs);
    return () => clearTimeout(timer);
  }, [slideId, enterMs, holdMs]);

  return (
    <AnimatePresence mode="sync">
      <motion.div
        key={slideId}
        className="absolute inset-0"
        style={{ willChange: 'opacity, transform' }}
        initial={{ opacity: 0, scale: 1.03 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{
          opacity: 0,
          transition: { duration: exitMs / 1000, ease: 'linear' },
        }}
        transition={{ duration: enterMs / 1000, ease: ENTER_EASING }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
