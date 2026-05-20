import type { CSSProperties } from 'react';

interface DriftProps {
  children: React.ReactNode;
  /** Duration of one full cycle in ms (default 8s) */
  duration?: number;
  /** Vertical range in px (default 8) */
  y?: number;
  /** Horizontal range in px (default 0) */
  x?: number;
  /** Scale variation (default 0 = no breathing) */
  scale?: number;
  className?: string;
}

/**
 * Continuous ambient drift. Pure CSS — uses custom properties as
 * keyframe inputs so amplitude and duration are per-instance while the
 * keyframe itself is shared. Pauses on outgoing slides.
 *
 * Keyframe lives in `app/globals.css` (`@keyframes drift-float`).
 */
export function Drift({
  children,
  duration = 8000,
  y = 8,
  x = 0,
  scale = 0,
  className,
}: DriftProps) {
  const style = {
    animationDuration: `${duration}ms`,
    '--drift-x': `${x}px`,
    '--drift-y': `${y}px`,
    '--drift-scale': scale,
  } as CSSProperties;

  return (
    <div className={`drift-anim ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}
