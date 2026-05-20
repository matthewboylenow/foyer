interface FilmGrainProps {
  opacity?: number;
  /** Accepted for API compat — animation removed (per-frame full-screen
   *  repaint with mix-blend was the single most expensive thing on the TV). */
  duration?: number;
}

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E`;

// Static grain overlay. Was previously animated + mix-blend-overlay; both
// were dropped — the jitter wasn't perceptible at 5% opacity and the blend
// mode forced full-frame compositing on weak GPUs every paint.
export function FilmGrain({ opacity = 0.05 }: FilmGrainProps) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none z-50"
      style={{
        backgroundImage: `url("${NOISE_SVG}")`,
        backgroundSize: '300px 300px',
        opacity,
      }}
    />
  );
}
