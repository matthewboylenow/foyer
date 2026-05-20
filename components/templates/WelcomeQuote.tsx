'use client';

import { motion } from 'motion/react';
import { WordStagger } from '@/components/motion/WordStagger';
import { WELCOME_QUOTE_SIZE, resolveSize } from './sizing';
import type { WelcomeQuoteContent } from '@/lib/db/schema';

interface WelcomeQuoteProps {
  content: WelcomeQuoteContent;
}

export function WelcomeQuote({ content }: WelcomeQuoteProps) {
  const { quote, attribution, quoteSize } = content;
  const sizePx = resolveSize(WELCOME_QUOTE_SIZE, quoteSize);

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 60%, rgba(212,175,55,0.06) 0%, transparent 70%)',
        }}
      />
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }} />

      <div
        className="relative z-10 flex flex-col items-center justify-center h-full text-center"
        style={{ padding: '120px 80px' }}
      >
        <div
          className="font-serif text-navy mb-6"
          style={{ fontSize: 120, lineHeight: 0.6, opacity: 0.15 }}
          aria-hidden
        >
          &#8220;
        </div>

        <h2 className="font-serif text-navy leading-tight mb-8" style={{ fontSize: sizePx }}>
          <WordStagger text={quote} delay={0} staggerMs={80} />
        </h2>

        {attribution && (
          <motion.p
            className="font-sans text-rust uppercase tracking-widest"
            style={{ fontSize: 22 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            — {attribution}
          </motion.p>
        )}
      </div>
    </div>
  );
}
