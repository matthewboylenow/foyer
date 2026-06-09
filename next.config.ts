import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
    // Blob URLs are immutable (random suffix per upload), so optimized
    // variants can sit in the image cache for 31 days minimum — keeps the
    // optimizer from re-fetching originals from Blob storage.
    minimumCacheTTL: 2678400,
  },
  headers: async () => [
    {
      source: '/api/display/:path*',
      headers: [{ key: 'Cache-Control', value: 'no-store' }],
    },
    {
      source: '/fonts/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ],
};

export default config;
