'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// Two easing curves — entrance feels like focus pulling in, exit gets out of the way fast.
const ENTER_EASING: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EXIT_EASING: [number, number, number, number] = [0.7, 0, 0.84, 0];

interface SlideFrameProps {
  children: React.ReactNode;
  slideId: string;
  holdMs: number;
  enterMs?: number;
  exitMs?: number;
  onDone: () => void;
}

/**
 * Cross-dissolve with scale + blur cinematic feel.
 * - Entering: opacity 0 → 1, scale 1.04 → 1.0, blur 8px → 0
 * - Exiting:  opacity 1 → 0, scale 1.0 → 0.98 (no blur, gets out quick)
 *
 * The slight inbound scale ("pushing in from beyond the camera") plus the
 * blur defocus is the move that reads as After Effects / film-cut feel
 * rather than a flat web fade.
 */
export function SlideFrame({
  children,
  slideId,
  holdMs,
  enterMs = 1400,
  exitMs = 700,
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
        initial={{ opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1.0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.98, filter: 'blur(0px)' }}
        transition={{
          opacity: { duration: enterMs / 1000, ease: ENTER_EASING },
          scale: { duration: enterMs / 1000, ease: ENTER_EASING },
          filter: { duration: (enterMs * 0.7) / 1000, ease: ENTER_EASING },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
