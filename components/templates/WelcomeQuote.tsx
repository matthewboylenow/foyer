'use client';

import { motion } from 'motion/react';
import { WordStagger } from '@/components/motion/WordStagger';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { Drift } from '@/components/motion/Drift';
import { WELCOME_QUOTE_SIZE, resolveSize } from './sizing';
import type { WelcomeQuoteContent } from '@/lib/db/schema';

export function WelcomeQuote({ content }: { content: WelcomeQuoteContent }) {
  const { quote, attribution, quoteSize } = content;
  const sizePx = resolveSize(WELCOME_QUOTE_SIZE, quoteSize);

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Warm breathing background */}
      <motion.div
        className="absolute inset-0"
        animate={{
          background: [
            'radial-gradient(ellipse at 50% 40%, rgba(212,175,55,0.08) 0%, transparent 65%)',
            'radial-gradient(ellipse at 55% 50%, rgba(212,175,55,0.10) 0%, transparent 70%)',
            'radial-gradient(ellipse at 45% 45%, rgba(212,175,55,0.06) 0%, transparent 65%)',
            'radial-gradient(ellipse at 50% 40%, rgba(212,175,55,0.08) 0%, transparent 65%)',
          ],
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Soft rust accent low */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 100%, rgba(205,83,52,0.06) 0%, transparent 50%)',
        }}
      />

      <FilmGrain opacity={0.04} />

      <div
        className="relative z-10 flex flex-col items-center justify-center h-full text-center"
        style={{ padding: '120px 80px' }}
      >
        {/* Decorative open quote mark — drifts in and floats */}
        <BlurIn delay={0} duration={1400} y={-14} blur={10}>
          <Drift duration={9000} y={6} x={2}>
            <div
              className="font-serif text-navy mb-2"
              style={{ fontSize: 160, lineHeight: 0.6, opacity: 0.12 }}
              aria-hidden
            >
              &#8220;
            </div>
          </Drift>
        </BlurIn>

        {/* Quote with word stagger */}
        <h2
          className="font-serif text-navy leading-tight mb-10 mt-2"
          style={{ fontSize: sizePx, letterSpacing: '-0.01em' }}
        >
          <WordStagger text={quote} delay={600} staggerMs={90} />
        </h2>

        {/* Gold rule */}
        <motion.div
          className="h-px bg-rust mb-6"
          style={{ originX: 0.5 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.5 }}
          transition={{ duration: 1.4, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="w-24" />
        </motion.div>

        {attribution && (
          <BlurIn delay={1800} duration={1100} y={6} blur={6} as="p">
            <span
              className="font-sans text-rust uppercase tracking-widest block"
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
