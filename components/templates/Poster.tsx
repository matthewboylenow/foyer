'use client';

import { BlurIn } from '@/components/motion/BlurIn';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { QrBadge } from './QrBadge';
import type { PosterContent, SlideOrientation } from '@/lib/db/schema';

interface PosterProps {
  content: PosterContent;
  orientation?: SlideOrientation;
  /** Resolved blob URL for content.imageMediaId. */
  imageUrl?: string;
}

/**
 * Full-bleed flyer. A ministry's finished poster goes on screen as-is.
 * Default 'contain' shows the whole image over a blurred, darkened copy of
 * itself so a letter-size flyer on a 9:16 screen never has hard black bars.
 */
export function Poster({ content, orientation = 'portrait', imageUrl }: PosterProps) {
  const { fit = 'contain', caption, qrUrl, qrLabel } = content;
  const isLandscape = orientation === 'landscape';

  if (!imageUrl) {
    return (
      <div className="relative w-full h-full bg-navy-900 grid place-items-center">
        <p className="font-sans text-cream/40 uppercase tracking-widest" style={{ fontSize: 40 }}>
          Upload a flyer
        </p>
      </div>
    );
  }

  const hasFooter = !!caption || !!qrUrl;

  return (
    <div className="relative w-full h-full overflow-hidden bg-ink">
      {/* Blurred backdrop (contain mode only) */}
      {fit === 'contain' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(48px) brightness(0.45) saturate(1.1)', transform: 'scale(1.15)' }}
        />
      )}

      {/* The flyer */}
      <BlurIn delay={0} duration={1100} y={12} blur={10} className="absolute inset-0">
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            padding: fit === 'contain' ? (isLandscape ? '60px 80px' : '80px 60px') : 0,
            paddingBottom:
              fit === 'contain' && hasFooter ? (isLandscape ? 60 : 380) : fit === 'contain' ? (isLandscape ? 60 : 80) : 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={caption ?? 'Flyer'}
            className={fit === 'cover' ? 'w-full h-full object-cover' : 'max-w-full max-h-full object-contain'}
            style={
              fit === 'contain'
                ? { filter: 'drop-shadow(0 30px 70px rgba(0,0,0,0.55))', borderRadius: 8 }
                : undefined
            }
          />
        </div>
      </BlurIn>

      <FilmGrain opacity={0.04} />

      {/* Footer: caption + QR */}
      {hasFooter && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-10"
          style={{
            padding: isLandscape ? '40px 80px 60px' : '60px 80px 100px',
            background: 'linear-gradient(180deg, rgba(11,13,18,0) 0%, rgba(11,13,18,0.85) 45%, rgba(11,13,18,0.95) 100%)',
          }}
        >
          {caption ? (
            <BlurIn delay={900} duration={900} y={8} className="min-w-0 flex-1">
              <p
                className="font-serif text-cream leading-tight"
                style={{ fontSize: isLandscape ? 44 : 52, letterSpacing: '-0.01em' }}
              >
                {caption}
              </p>
            </BlurIn>
          ) : (
            <span />
          )}
          {qrUrl && <QrBadge url={qrUrl} label={qrLabel || 'Scan to sign up'} size={isLandscape ? 200 : 240} />}
        </div>
      )}
    </div>
  );
}
