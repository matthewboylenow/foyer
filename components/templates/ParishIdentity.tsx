'use client';

import { GradientShift } from '@/components/motion/GradientShift';
import { WordStagger } from '@/components/motion/WordStagger';
import { motion } from 'motion/react';
import {
  PARISH_IDENTITY_LOGO_MAX_WIDTH,
  PARISH_IDENTITY_HEADLINE_SIZE,
  resolveSize,
} from './sizing';
import type { ParishIdentityContent } from '@/lib/db/schema';

interface ParishIdentityProps {
  content: ParishIdentityContent;
  logoUrl?: string;
}

export function ParishIdentity({ content, logoUrl }: ParishIdentityProps) {
  const { headline, subline, logoSize, headlineSize } = content;

  const logoMaxWidth = resolveSize(PARISH_IDENTITY_LOGO_MAX_WIDTH, logoSize);
  const headlinePx = resolveSize(PARISH_IDENTITY_HEADLINE_SIZE, headlineSize);

  return (
    <div className="relative w-full h-full overflow-hidden bg-navy-900">
      <GradientShift colors={['#1F346D', '#16264E']} duration={20000} pattern="shift" />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'0.04\'/%3E%3C/svg%3E")',
          backgroundSize: '200px 200px',
          opacity: 0.04,
        }}
      />

      <div
        className="relative z-10 flex flex-col items-center justify-center h-full"
        style={{ padding: '120px 80px' }}
      >
        {logoUrl && (
          <motion.div
            className="mb-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt="Parish logo"
              style={{ maxWidth: logoMaxWidth, maxHeight: logoMaxWidth * 0.5, objectFit: 'contain' }}
            />
          </motion.div>
        )}

        <div className="text-center mb-6">
          <h1 className="font-serif text-cream leading-tight" style={{ fontSize: headlinePx }}>
            <WordStagger text={headline} delay={600} staggerMs={100} />
          </h1>
        </div>

        {subline && (
          <motion.div
            className="font-sans text-cream text-center leading-relaxed [&_p]:m-0 [&_p+p]:mt-2"
            style={{ fontSize: 36, opacity: 0.7 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            transition={{ duration: 0.8, delay: 1.4 }}
            dangerouslySetInnerHTML={{ __html: subline }}
          />
        )}
      </div>
    </div>
  );
}
