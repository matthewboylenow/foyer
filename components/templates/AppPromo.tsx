'use client';

import { motion } from 'motion/react';
import { LineMask } from '@/components/motion/LineMask';
import { WordStagger } from '@/components/motion/WordStagger';
import { GradientShift } from '@/components/motion/GradientShift';
import { APP_PROMO_HEADLINE_SIZE, resolveSize } from './sizing';
import type { AppPromoContent } from '@/lib/db/schema';

interface AppPromoProps {
  content: AppPromoContent;
  phoneMockupUrl?: string;
}

export function AppPromo({ content, phoneMockupUrl }: AppPromoProps) {
  const { headline, body, url, headlineSize } = content;
  const headlinePx = resolveSize(APP_PROMO_HEADLINE_SIZE, headlineSize);

  return (
    <div className="relative w-full h-full overflow-hidden bg-navy-900">
      <GradientShift colors={['#1F346D', '#2D1B69']} duration={20000} pattern="shift" />
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }} />

      <div
        className="relative z-10 flex flex-col justify-between h-full"
        style={{ padding: '120px 80px' }}
      >
        <div>
          <h2 className="font-serif text-cream leading-tight mb-8" style={{ fontSize: headlinePx }}>
            <LineMask text={headline} delay={0} duration={900} />
          </h2>
          <p className="font-sans text-cream leading-relaxed" style={{ fontSize: 48, opacity: 0.8 }}>
            <WordStagger text={body} delay={1000} staggerMs={60} />
          </p>
        </div>

        {phoneMockupUrl && (
          <motion.div
            className="flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phoneMockupUrl}
                alt="App mockup"
                style={{ maxHeight: 600, objectFit: 'contain' }}
              />
            </motion.div>
          </motion.div>
        )}

        <motion.p
          className="font-serif text-gold"
          style={{ fontSize: 64 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.8 }}
        >
          {url}
        </motion.p>
      </div>
    </div>
  );
}
