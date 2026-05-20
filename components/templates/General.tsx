'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import { SplitReveal } from '@/components/motion/SplitReveal';
import { KenBurns } from '@/components/motion/KenBurns';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { AutoFitText } from './AutoFitText';
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
          <KenBurns src={bgImageUrl} duration={22000} />
          {/* Stronger overlay near content area, lighter at edges, for legibility + atmosphere */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(250,249,247,0.78) 0%, rgba(250,249,247,0.55) 50%, rgba(250,249,247,0.85) 100%)',
            }}
          />
        </>
      )}

      {/* Subtle warm accent on the rust meta line zone */}
      {!bgImageUrl && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 0% 40%, rgba(205,83,52,0.05) 0%, transparent 50%)',
          }}
        />
      )}

      <FilmGrain opacity={0.04} />

      <div
        className="relative z-10 flex flex-col h-full"
        style={{ padding: '120px 80px' }}
      >
        {/* Headline */}
        <h2
          className="font-serif text-navy leading-[1.05] mb-6"
          style={{ fontSize: headlinePx, letterSpacing: '-0.01em' }}
        >
          {motionStyle === 'splitReveal' ? (
            <SplitReveal text={headline} delay={0} duration={1100} />
          ) : (
            <LineMask text={headline} delay={0} duration={1000} />
          )}
        </h2>

        {/* Meta — slides in from the left with a quick blur */}
        {meta && (
          <BlurIn delay={900} duration={900} y={0} blur={6}>
            <motion.p
              className="font-sans text-rust uppercase tracking-widest mb-10 inline-block"
              style={{ fontSize: 28, paddingLeft: '0.1em' }}
              initial={{ x: -16 }}
              animate={{ x: 0 }}
              transition={{ duration: 0.9, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-block w-12 h-px bg-rust align-middle mr-4" />
              {meta}
            </motion.p>
          </BlurIn>
        )}

        {/* Body — auto-shrinks from 48px down to 24px if content is long */}
        {body && body.replace(/<[^>]*>/g, '').trim() && (
          <BlurIn
            delay={1500}
            duration={1100}
            y={10}
            blur={8}
            className="flex-1 min-h-0 overflow-hidden"
          >
            <AutoFitText
              html={body}
              maxSize={48}
              minSize={24}
              className="font-sans text-navy leading-relaxed [&_p]:m-0 [&_p+p]:mt-4 [&_ul]:list-disc [&_ul]:pl-8 [&_li]:mt-1 [&_strong]:font-semibold [&_em]:italic"
            />
          </BlurIn>
        )}
      </div>
    </div>
  );
}
