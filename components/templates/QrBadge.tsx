'use client';

import { QRCodeSVG } from 'qrcode.react';
import { BlurIn } from '@/components/motion/BlurIn';

interface QrBadgeProps {
  url: string;
  label?: string;
  /** QR module size in canvas px. */
  size?: number;
  /** 'card' = cream card with navy modules (for any background).
   *  'plain' = no card, modules in the current text colour. */
  variant?: 'card' | 'plain';
  delay?: number;
  className?: string;
}

/** Ensure the encoded URL has a scheme so phones open it, while the
 *  caption can stay short ("sainthelen.org/lifelines"). */
export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
}

/**
 * A scannable QR code with a caption, sized for a TV at 3–6 m. 260px on a
 * 1080-wide canvas is about 8 cm on a 43" portrait screen — large enough
 * for a phone camera from a normal standing distance.
 */
export function QrBadge({
  url,
  label = 'Scan to sign up',
  size = 260,
  variant = 'card',
  delay = 1800,
  className,
}: QrBadgeProps) {
  const value = normalizeUrl(url);
  if (!value) return null;
  const pad = 28;
  return (
    <BlurIn delay={delay} duration={900} y={8} className={className}>
      <div
        className={variant === 'card' ? 'rounded-2xl bg-cream shadow-[0_20px_60px_rgba(0,0,0,0.25)]' : ''}
        style={{ padding: variant === 'card' ? pad : 0, width: size + (variant === 'card' ? pad * 2 : 0) }}
      >
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          bgColor="transparent"
          fgColor={variant === 'card' ? '#1F346D' : 'currentColor'}
          marginSize={0}
        />
        {label && (
          <p
            className={`font-sans text-center leading-tight mt-4 ${
              variant === 'card' ? 'text-navy' : ''
            }`}
            style={{ fontSize: 30, fontWeight: 600 }}
          >
            {label}
          </p>
        )}
      </div>
    </BlurIn>
  );
}
