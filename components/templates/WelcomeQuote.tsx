'use client';

import { motion } from 'motion/react';
import { WordStagger } from '@/components/motion/WordStagger';
import type { WelcomeQuoteContent } from '@/lib/db/schema';

interface WelcomeQuoteProps {
  content: WelcomeQuoteContent;
}

export function WelcomeQuote({ content }: WelcomeQuoteProps) {
  const { quote, attribution } = content;

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Subtle warm gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 60%, rgba(212,175,55,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Grain overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.04 }}
      />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col items-center justify-center h-full text-center"
        style={{ padding: '120px 80px' }}
      >
        {/* Opening quote mark */}
        <div
          className="font-serif text-navy mb-6"
          style={{ fontSize: 120, lineHeight: 0.6, opacity: 0.15 }}
          aria-hidden
        >
          &#8220;
        </div>

        <h2 className="font-serif text-navy leading-tight mb-8" style={{ fontSize: 96 }}>
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
