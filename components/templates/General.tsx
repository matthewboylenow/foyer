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
import { QrBadge } from './QrBadge';
import type { GeneralContent, SlideOrientation } from '@/lib/db/schema';

interface GeneralProps {
  content: GeneralContent;
  orientation?: SlideOrientation;
  bgImageUrl?: string;
}

/** "Sunday, October 12" from a YYYY-MM-DD string, parsed as local parts
 *  (never via new Date(string), which reads as UTC and shifts a day). */
export function formatEventDate(ymd: string | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function General({ content, orientation = 'portrait', bgImageUrl }: GeneralProps) {
  const { headline, body, headlineSize, motionStyle = 'lineMask', textMode, eventDate, qrUrl, qrLabel } = content;
  // Free-text meta wins; otherwise a structured event date renders as a line.
  const meta = content.meta?.trim() || formatEventDate(eventDate);
  const headlinePx = resolveSize(GENERAL_HEADLINE_SIZE, headlineSize);
  const p = palette(textMode ?? 'dark');
  const isLandscape = orientation === 'landscape';
  const padding = isLandscape ? '80px 160px' : '120px 80px';
  const hasQr = !!qrUrl?.trim();

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

        {/* QR footer — takes its own row so the body shrinks to fit above it. */}
        {hasQr && (
          <div className={`flex ${isLandscape ? 'justify-end' : 'justify-start'} shrink-0`} style={{ paddingTop: 48 }}>
            <QrBadge url={qrUrl!} label={qrLabel || 'Scan to sign up'} size={isLandscape ? 200 : 240} />
          </div>
        )}
      </div>
    </div>
  );
}
