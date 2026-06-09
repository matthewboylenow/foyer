'use client';

import { GradientShift } from '@/components/motion/GradientShift';
import { WordStagger } from '@/components/motion/WordStagger';
import { BlurIn } from '@/components/motion/BlurIn';
import { Drift } from '@/components/motion/Drift';
import { FilmGrain } from '@/components/motion/FilmGrain';
import { GlowPulse } from '@/components/motion/GlowPulse';
import { KenBurns } from '@/components/motion/KenBurns';
import { motion } from 'motion/react';
import {
  PARISH_IDENTITY_HEADLINE_SIZE,
  resolveSize,
  resolveLogoWidth,
} from './sizing';
import type { ParishIdentityContent, SlideOrientation } from '@/lib/db/schema';

interface ParishIdentityProps {
  content: ParishIdentityContent;
  orientation?: SlideOrientation;
  logoUrl?: string;
  bgImageUrl?: string;
  bgVideoUrl?: string;
  // Still frame captured at upload — admin previews (slide cards, editor,
  // Now Playing) render this instead of streaming the video from Blob.
  bgVideoPosterUrl?: string;
  // Explicit opt-in to actually stream + play the video (the full-size
  // preview page). Admin thumbnails never set this.
  bgVideoAutoPlay?: boolean;
  // When true, the bg video is mounted by the Player at a layer above the
  // SlideFrame and persists across slide rotations — this template should
  // skip rendering its own <video> and let the parent show through.
  bgVideoExternal?: boolean;
}

/**
 * Splits an HTML subline into individual lines for per-line stagger.
 * Handles TipTap's <p>...</p> and <br> output, plus plain-text strings
 * with newlines (legacy).
 */
function parseSublineLines(html: string): string[] {
  if (!html) return [];
  if (html.includes('<p>')) {
    return html
      .split(/<\/?p[^>]*>/i)
      .map((s) => s.replace(/<br\s*\/?>/gi, ' ').trim())
      .filter(Boolean);
  }
  if (html.includes('<br')) {
    return html
      .split(/<br\s*\/?>/i)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return html
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ParishIdentity({ content, orientation = 'portrait', logoUrl, bgImageUrl, bgVideoUrl, bgVideoPosterUrl, bgVideoAutoPlay, bgVideoExternal }: ParishIdentityProps) {
  const { headline, subline, logoSize, headlineSize } = content;

  const logoMaxWidth = resolveLogoWidth(logoSize);
  const headlinePx = resolveSize(PARISH_IDENTITY_HEADLINE_SIZE, headlineSize);
  const lines = subline ? parseSublineLines(subline) : [];

  const hasMedia = Boolean(bgVideoUrl || bgImageUrl);
  const isLandscape = orientation === 'landscape';
  const padding = isLandscape ? '60px 160px' : '120px 80px';
  // When the Player owns the bg video (persistent layer behind the slide),
  // this template renders a transparent root so the video shows through and
  // skips the local <video>. The tint/overlay layers still apply on top.
  const rootBg = bgVideoUrl && bgVideoExternal ? '' : 'bg-navy-900';

  return (
    <div className={`relative w-full h-full overflow-hidden ${rootBg}`}>
      {/* Background media (video > image > gradient fallback).
          Outside the player (bgVideoExternal unset = admin previews), the
          video is never streamed: the captured poster frame stands in. A
          legacy video without a poster mounts metadata-only (~KBs, shows
          the first frame) instead of the old autoplay+preload=auto, which
          re-streamed the full file on every admin page view. */}
      {bgVideoUrl ? (
        bgVideoExternal ? null : bgVideoAutoPlay ? (
          <video
            src={bgVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={bgVideoPosterUrl}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : bgVideoPosterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgVideoPosterUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <video
            src={bgVideoUrl}
            muted
            loop
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )
      ) : bgImageUrl ? (
        <KenBurns src={bgImageUrl} duration={28000} />
      ) : (
        <GradientShift colors={['#1F346D', '#0B132A']} duration={28000} pattern="shift" />
      )}

      {/* Tint/legibility overlay on top of media so logo + text stay readable */}
      {hasMedia && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(11,19,42,0.55) 0%, rgba(11,19,42,0.4) 45%, rgba(11,19,42,0.7) 100%)',
          }}
        />
      )}

      {/* Ambient gold breathing glow centered behind the logo */}
      <GlowPulse
        color={hasMedia ? 'rgba(212,175,55,0.10)' : 'rgba(212,175,55,0.14)'}
        size={700}
        y="40%"
        duration={7000}
      />

      {/* Cool light from below */}
      <GlowPulse
        color="rgba(122,158,255,0.07)"
        size={500}
        y="100%"
        duration={9000}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(11,19,42,0.55) 100%)',
        }}
      />

      <FilmGrain opacity={0.06} />

      <div
        className="relative z-10 flex flex-col items-center justify-center h-full"
        style={{ padding }}
      >
        {logoUrl && (
          <BlurIn delay={200} duration={1400} y={20} blur={14} className="mb-14">
            <Drift duration={9000} y={6} scale={0.012}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Parish logo"
                style={{
                  maxWidth: logoMaxWidth,
                  maxHeight: logoMaxWidth * 0.7,
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.4))',
                }}
              />
            </Drift>
          </BlurIn>
        )}

        <div className="text-center mb-8">
          <h1
            className="font-serif text-cream leading-tight"
            style={{
              fontSize: headlinePx,
              textShadow: '0 2px 30px rgba(0,0,0,0.45)',
              letterSpacing: '-0.005em',
            }}
          >
            <WordStagger text={headline} delay={1000} staggerMs={120} />
          </h1>
        </div>

        {/* Subline — parish mission, rendered with flourish */}
        {lines.length > 0 && (
          <div className="flex flex-col items-center gap-3 mt-4">
            {lines.map((line, i) => (
              <BlurIn
                key={`${line}-${i}`}
                delay={1800 + i * 280}
                duration={1100}
                y={8}
                blur={6}
              >
                <p
                  className="font-serif italic text-cream text-center leading-snug"
                  style={{
                    fontSize: 40,
                    opacity: 0.92,
                    letterSpacing: '0.015em',
                    textShadow: '0 2px 14px rgba(0,0,0,0.35)',
                  }}
                >
                  {line}
                </p>

                {/* Gold dot ornament between lines */}
                {i < lines.length - 1 && (
                  <motion.div
                    className="flex justify-center pt-2"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 0.55, scale: 1 }}
                    transition={{
                      duration: 0.8,
                      delay: (1800 + i * 280 + 600) / 1000,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                  </motion.div>
                )}
              </BlurIn>
            ))}
          </div>
        )}

        {/* Gold accent line that draws in after the full mission has landed */}
        <motion.div
          className="mt-12 h-px bg-gold"
          style={{ originX: 0.5 }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 0.55 }}
          transition={{
            duration: 1.6,
            delay: (1800 + Math.max(0, lines.length - 1) * 280 + 1000) / 1000,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          <div className="w-40" />
        </motion.div>
      </div>
    </div>
  );
}
