'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import { SplitReveal } from '@/components/motion/SplitReveal';
import { KenBurns } from '@/components/motion/KenBurns';
import { GENERAL_HEADLINE_SIZE, resolveSize } from './sizing';
import type { GeneralContent } from '@/lib/db/schema';

interface GeneralProps {
  content: GeneralContent;
  bgImageUrl?: string;
}

export function General({ content, bgImageUrl }: GeneralProps) {
  const { headline, body, meta, headlineSize, motionStyle = 'lineMask' } = content;
  const headlinePx = resolveSize(GENERAL_HEADLINE_SIZE, headlineSize);

  return (
    <div className="relative w-full h-full overflow-hidden bg-cream">
      {bgImageUrl && (
        <>
          <KenBurns src={bgImageUrl} duration={20000} />
          <div className="absolute inset-0" style={{ background: 'rgba(250,249,247,0.6)' }} />
        </>
      )}

      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }} />

      <div
        className="relative z-10 flex flex-col h-full"
        style={{ padding: '120px 80px' }}
      >
        {/* Headline */}
        <h2 className="font-serif text-navy leading-tight mb-6" style={{ fontSize: headlinePx }}>
          {motionStyle === 'splitReveal' ? (
            <SplitReveal text={headline} delay={0} duration={900} />
          ) : (
            <LineMask text={headline} delay={0} duration={900} />
          )}
        </h2>

        {/* Meta line — between headline and body per Matthew's request */}
        {meta && (
          <motion.p
            className="font-sans text-rust uppercase tracking-widest mb-10"
            style={{ fontSize: 28 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            {meta}
          </motion.p>
        )}

        {/* Body (rich-text HTML from TipTap, or plain text from existing slides) */}
        {body && body.replace(/<[^>]*>/g, '').trim() && (
          <motion.div
            className="font-sans text-navy leading-relaxed [&_p]:m-0 [&_p+p]:mt-4 [&_ul]:list-disc [&_ul]:pl-8 [&_li]:mt-1 [&_strong]:font-semibold [&_em]:italic"
            style={{ fontSize: 48 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}
      </div>
    </div>
  );
}
