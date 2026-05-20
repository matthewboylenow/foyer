'use client';

import { GradientShift } from '@/components/motion/GradientShift';
import { WordStagger } from '@/components/motion/WordStagger';
import { BlurIn } from '@/components/motion/BlurIn';
import { Drift } from '@/components/motion/Drift';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { GlowPulse } from '@/components/motion/GlowPulse';
import { motion } from 'motion/react';
import {
  PARISH_IDENTITY_HEADLINE_SIZE,
  resolveSize,
  resolveLogoWidth,
} from './sizing';
import type { ParishIdentityContent } from '@/lib/db/schema';

interface ParishIdentityProps {
  content: ParishIdentityContent;
  logoUrl?: string;
}

export function ParishIdentity({ content, logoUrl }: ParishIdentityProps) {
  const { headline, subline, logoSize, headlineSize } = content;

  const logoMaxWidth = resolveLogoWidth(logoSize);
  const headlinePx = resolveSize(PARISH_IDENTITY_HEADLINE_SIZE, headlineSize);

  return (
    <div className="relative w-full h-full overflow-hidden bg-navy-900">
      {/* Layer 1: Deep navy gradient (slow rotational shift) */}
      <GradientShift colors={['#1F346D', '#0B132A']} duration={28000} pattern="shift" />

      {/* Layer 2: Warm gold breathing glow centered behind the logo */}
      <GlowPulse
        color="rgba(212,175,55,0.14)"
        size={700}
        y="40%"
        duration={7000}
      />

      {/* Layer 3: Soft cool light from below */}
      <GlowPulse
        color="rgba(122,158,255,0.08)"
        size={500}
        y="100%"
        duration={9000}
      />

      {/* Layer 4: Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(11,19,42,0.55) 100%)',
        }}
      />

      {/* Layer 5: Animated grain */}
      <FilmGrain opacity={0.06} />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full"
        style={{ padding: '120px 80px' }}
      >
        {logoUrl && (
          <BlurIn delay={200} duration={1400} y={20} blur={14} className="mb-14">
            <Drift duration={9000} y={6} scale={0.012}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Parish logo"
                style={{
                  maxWidth: logoMaxWidth,
                  // Cap height at ~70% of width — accommodates square logos (which
                  // render at logoMaxWidth × 0.7) and wide wordmarks (which
                  // remain bound by maxWidth + their natural aspect ratio).
                  maxHeight: logoMaxWidth * 0.7,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.35))',
                }}
              />
            </Drift>
          </BlurIn>
        )}

        <div className="text-center mb-8">
          <h1
            className="font-serif text-cream leading-tight"
            style={{ fontSize: headlinePx, textShadow: '0 2px 30px rgba(0,0,0,0.4)' }}
          >
            <WordStagger text={headline} delay={1000} staggerMs={120} />
          </h1>
        </div>

        {subline && (
          <BlurIn delay={1800} duration={1200} y={10} blur={8}>
            <div
              className="font-sans text-cream text-center leading-relaxed [&_p]:m-0 [&_p+p]:mt-2"
              style={{ fontSize: 36, opacity: 0.75, letterSpacing: '0.02em' }}
              dangerouslySetInnerHTML={{ __html: subline }}
            />
          </BlurIn>
        )}

        {/* Gold accent line that draws in after everything settles */}
        <motion.div
          className="mt-10 h-px bg-gold"
          style={{ originX: 0.5 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.6 }}
          transition={{ duration: 1.6, delay: 2.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-32" />
        </motion.div>
      </div>
    </div>
  );
}
