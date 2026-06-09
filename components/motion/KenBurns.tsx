import Image from 'next/image';

interface KenBurnsProps {
  src: string;
  alt?: string;
  /** Cycle length in ms. The animation alternates, so half this is one direction. */
  duration?: number;
  className?: string;
}

/**
 * Slow alternating zoom over a background image. Pure CSS so it runs on
 * the compositor and respects `animation-play-state: paused` — which is
 * how SlideFrame freezes outgoing-slide motion during transitions.
 *
 * The actual keyframe lives in `app/globals.css` (`@keyframes ken-burns`).
 */
export function KenBurns({ src, alt = '', duration = 20000, className }: KenBurnsProps) {
  return (
    <div className={`absolute inset-0 overflow-hidden ${className ?? ''}`}>
      <div
        className="ken-burns-anim absolute inset-0"
        style={{ animationDuration: `${duration}ms` }}
      >
        {/* sizes="100vw" is load-bearing: Player's prewarm builds the same
            srcset via getImageProps so the warmed URL matches this render. */}
        <Image src={src} alt={alt} fill sizes="100vw" className="object-cover" priority />
      </div>
    </div>
  );
}
