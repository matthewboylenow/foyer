'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useIsPresent } from 'motion/react';

const ENTER_EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];

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
    const totalMs = enterMs + holdMs;
    const timer = setTimeout(() => onDoneRef.current(), totalMs);
    return () => clearTimeout(timer);
  }, [slideId, enterMs, holdMs]);

  return (
    <AnimatePresence mode="sync">
      <SlideLayer key={slideId} enterMs={enterMs} exitMs={exitMs}>
        {children}
      </SlideLayer>
    </AnimatePresence>
  );
}

// Inner layer so `useIsPresent()` reports this slide's presence (not the
// SlideFrame's). When it returns false, AnimatePresence is running its exit
// animation; we set data-exiting so globals.css can pause ambient motion
// (ken-burns/glow-pulse/drift) on the outgoing copy.
function SlideLayer({
  children,
  enterMs,
  exitMs,
}: {
  children: React.ReactNode;
  enterMs: number;
  exitMs: number;
}) {
  const isPresent = useIsPresent();

  return (
    <motion.div
      className="absolute inset-0"
      data-exiting={!isPresent ? 'true' : undefined}
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
  );
}
