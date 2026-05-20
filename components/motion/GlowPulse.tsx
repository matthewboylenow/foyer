interface GlowPulseProps {
  /** CSS color, e.g. 'rgba(212,175,55,0.18)' */
  color?: string;
  /** Glow size in px (radius) — default 600 */
  size?: number;
  /** Position as CSS units, default centered */
  x?: string;
  y?: string;
  /** Breathing cycle in ms */
  duration?: number;
  className?: string;
}

/**
 * Slow radial glow that breathes. Pure CSS animation so it composites
 * cheaply and pauses on outgoing slides via `[data-exiting]` in globals.css.
 *
 * Keyframe lives in `app/globals.css` (`@keyframes glow-pulse`).
 */
export function GlowPulse({
  color = 'rgba(212,175,55,0.18)',
  size = 600,
  x = '50%',
  y = '50%',
  duration = 6000,
  className,
}: GlowPulseProps) {
  return (
    <div
      aria-hidden
      className={`glow-pulse-anim absolute inset-0 pointer-events-none ${className ?? ''}`}
      style={{
        background: `radial-gradient(ellipse ${size}px ${size * 1.2}px at ${x} ${y}, ${color} 0%, transparent 70%)`,
        animationDuration: `${duration}ms`,
      }}
    />
  );
}
