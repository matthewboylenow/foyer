'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import { WordStagger } from '@/components/motion/WordStagger';
import { GradientShift } from '@/components/motion/GradientShift';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { GlowPulse } from '@/components/motion/GlowPulse';
import { Drift } from '@/components/motion/Drift';
import { APP_PROMO_HEADLINE_SIZE, resolveSize } from './sizing';
import type { AppPromoContent } from '@/lib/db/schema';

interface AppPromoProps {
  content: AppPromoContent;
  phoneMockupUrl?: string;
}

export function AppPromo({ content, phoneMockupUrl }: AppPromoProps) {
  const { headline, body, url, headlineSize } = content;
  const headlinePx = resolveSize(APP_PROMO_HEADLINE_SIZE, headlineSize);

  return (
    <div className="relative w-full h-full overflow-hidden bg-navy-900">
      <GradientShift colors={['#1F346D', '#1A1B4E']} duration={24000} pattern="shift" />

      {/* Gold glow that suggests "light from the phone" */}
      <GlowPulse color="rgba(212,175,55,0.12)" size={650} y="55%" duration={8000} />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(11,19,42,0.6) 100%)',
        }}
      />

      <FilmGrain opacity={0.05} />

      <div
        className="relative z-10 flex flex-col justify-between h-full"
        style={{ padding: '120px 80px' }}
      >
        <div>
          <h2
            className="font-serif text-cream leading-[1.05] mb-8"
            style={{ fontSize: headlinePx, letterSpacing: '-0.01em' }}
          >
            <LineMask text={headline} delay={0} duration={1000} />
          </h2>
          <BlurIn delay={1100} duration={1100} y={8} blur={6}>
            <p
              className="font-sans text-cream leading-relaxed"
              style={{ fontSize: 48, opacity: 0.78 }}
            >
              <WordStagger text={body} delay={0} staggerMs={70} />
            </p>
          </BlurIn>
        </div>

        {phoneMockupUrl && (
          <BlurIn delay={400} duration={1400} y={20} blur={14}>
            <Drift duration={5000} y={14} scale={0.008}>
              <div className="flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={phoneMockupUrl}
                  alt="App mockup"
                  style={{
                    maxHeight: 620,
                    objectFit: 'contain',
                    filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.4))',
                  }}
                />
              </div>
            </Drift>
          </BlurIn>
        )}

        <BlurIn delay={2200} duration={900} y={6} blur={4} as="p">
          <span
            className="font-serif text-gold block"
            style={{ fontSize: 64, textShadow: '0 4px 20px rgba(212,175,55,0.25)' }}
          >
            {url}
          </span>
        </BlurIn>
      </div>
    </div>
  );
}
