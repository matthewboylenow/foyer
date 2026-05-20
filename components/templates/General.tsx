'use client';

import { motion } from 'motion/react';
import { WordStagger } from '@/components/motion/WordStagger';
import { LineMask } from '@/components/motion/LineMask';
import { SplitReveal } from '@/components/motion/SplitReveal';
import { KenBurns } from '@/components/motion/KenBurns';
import type { GeneralContent } from '@/lib/db/schema';

interface GeneralProps {
  content: GeneralContent;
  bgImageUrl?: string;
}

export function General({ content, bgImageUrl }: GeneralProps) {
  const { headline, body, meta, motionStyle = 'lineMask' } = content;

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {/* Optional background image with Ken Burns */}
      {bgImageUrl && (
        <>
          <KenBurns src={bgImageUrl} duration={20000} />
          {/* Cream overlay for legibility */}
          <div className="absolute inset-0" style={{ background: 'rgba(250,249,247,0.6)' }} />
        </>
      )}

      {/* Grain */}
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }} />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col justify-between h-full"
        style={{ padding: '120px 80px' }}
      >
        {/* Headline */}
        <div>
          <h2 className="font-serif text-navy leading-tight mb-10" style={{ fontSize: 140 }}>
            {motionStyle === 'splitReveal' ? (
              <SplitReveal text={headline} delay={0} duration={900} />
            ) : (
              <LineMask text={headline} delay={0} duration={900} />
            )}
          </h2>

          {/* Body text */}
          <div className="font-sans text-navy leading-relaxed" style={{ fontSize: 48 }}>
            <WordStagger text={body} delay={1000} staggerMs={60} />
          </div>
        </div>

        {/* Meta line */}
        {meta && (
          <motion.p
            className="font-sans text-rust uppercase tracking-widest"
            style={{ fontSize: 28 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.8 }}
          >
            {meta}
          </motion.p>
        )}
      </div>
    </div>
  );
}
