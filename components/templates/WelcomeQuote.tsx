'use client';

import { motion } from 'motion/react';
import { WordStagger } from '@/components/motion/WordStagger';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { Drift } from '@/components/motion/Drift';
import { WELCOME_QUOTE_SIZE, resolveSize } from './sizing';
import { palette } from './style';
import { BgLayer } from './BgLayer';
import type { WelcomeQuoteContent } from '@/lib/db/schema';

interface WelcomeQuoteProps {
  content: WelcomeQuoteContent;
  bgImageUrl?: string;
}

export function WelcomeQuote({ content, bgImageUrl }: WelcomeQuoteProps) {
  const { quote, attribution, quoteSize, textMode } = content;
  const sizePx = resolveSize(WELCOME_QUOTE_SIZE, quoteSize);
  const p = palette(textMode ?? 'dark');

  return (
    <div className={`relative w-full h-full overflow-hidden ${p.pageBg}`}>
      <BgLayer bgImageUrl={bgImageUrl} tint={p.bgImageTint} ambient={p.ambient} />

      <FilmGrain opacity={0.04} />

      <div
        className="relative z-10 flex flex-col items-center justify-center h-full text-center"
        style={{ padding: '120px 80px' }}
      >
        {/* Decorative open quote mark — drifts in and floats */}
        <BlurIn delay={0} duration={1400} y={-14}>
          <Drift duration={9000} y={6} x={2}>
            <div
              className={`font-serif mb-2 ${p.primary}`}
              style={{ fontSize: 160, lineHeight: 0.6, opacity: 0.12 }}
              aria-hidden
            >
              &#8220;
            </div>
          </Drift>
        </BlurIn>

        {/* Quote with word stagger */}
        <h2
          className={`font-serif leading-tight mb-10 mt-2 ${p.primary}`}
          style={{ fontSize: sizePx, letterSpacing: '-0.01em' }}
        >
          <WordStagger text={quote} delay={600} staggerMs={90} />
        </h2>

        {/* Accent rule */}
        <motion.div
          className={`h-px mb-6 ${p.rule}`}
          style={{ originX: 0.5 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.5 }}
          transition={{ duration: 1.4, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-24" />
        </motion.div>

        {attribution && (
          <BlurIn delay={1800} duration={1100} y={6} as="p">
            <span
              className={`font-sans uppercase tracking-widest block ${p.accent}`}
              style={{ fontSize: 22 }}
            >
              {attribution}
            </span>
          </BlurIn>
        )}
      </div>
    </div>
  );
}
