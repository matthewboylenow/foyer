'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import { SplitReveal } from '@/components/motion/SplitReveal';
import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { AutoFitText } from './AutoFitText';
import { GENERAL_HEADLINE_SIZE, resolveSize } from './sizing';
import { palette } from './style';
import { BgLayer } from './BgLayer';
import type { GeneralContent, SlideOrientation } from '@/lib/db/schema';

interface GeneralProps {
  content: GeneralContent;
  orientation?: SlideOrientation;
  bgImageUrl?: string;
}

export function General({ content, orientation = 'portrait', bgImageUrl }: GeneralProps) {
  const { headline, body, meta, headlineSize, motionStyle = 'lineMask', textMode } = content;
  const headlinePx = resolveSize(GENERAL_HEADLINE_SIZE, headlineSize);
  const p = palette(textMode ?? 'dark');
  const isLandscape = orientation === 'landscape';
  const padding = isLandscape ? '80px 160px' : '120px 80px';

  return (
    <div className={`relative w-full h-full overflow-hidden ${p.pageBg}`}>
      <BgLayer
        bgImageUrl={bgImageUrl}
        tint={p.bgImageTint}
        ambient={
          textMode === 'light'
            ? p.ambient
            : 'radial-gradient(ellipse at 0% 40%, rgba(205,83,52,0.05) 0%, transparent 50%)'
        }
      />

      <FilmGrain opacity={0.04} />

      <div
        className="relative z-10 flex flex-col h-full"
        style={{ padding }}
      >
        {/* Headline */}
        <h2
          className={`font-serif leading-[1.05] mb-6 ${p.primary}`}
          style={{ fontSize: headlinePx, letterSpacing: '-0.01em' }}
        >
          {motionStyle === 'splitReveal' ? (
            <SplitReveal text={headline} delay={0} duration={1100} />
          ) : (
            <LineMask text={headline} delay={0} duration={1000} />
          )}
        </h2>

        {/* Meta — slides in from the left */}
        {meta && (
          <BlurIn delay={900} duration={900} y={0}>
            <motion.p
              className={`font-sans uppercase tracking-widest mb-10 inline-block ${p.accent}`}
              style={{ fontSize: 34, paddingLeft: '0.1em' }}
              initial={{ x: -16 }}
              animate={{ x: 0 }}
              transition={{ duration: 0.9, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className={`inline-block w-12 h-px align-middle mr-4 ${p.rule}`} />
              {meta}
            </motion.p>
          </BlurIn>
        )}

        {/* Body */}
        {body && body.replace(/<[^>]*>/g, '').trim() && (
          <BlurIn
            delay={1500}
            duration={1100}
            y={10}
            className="flex-1 min-h-0 overflow-hidden"
          >
            <AutoFitText
              html={body}
              maxSize={48}
              minSize={24}
              className={`font-sans leading-relaxed [&_p]:m-0 [&_p+p]:mt-4 [&_ul]:list-disc [&_ul]:pl-8 [&_li]:mt-1 [&_strong]:font-semibold [&_em]:italic ${p.primary}`}
            />
          </BlurIn>
        )}
      </div>
    </div>
  );
}
