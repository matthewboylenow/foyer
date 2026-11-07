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
      // Backgrounds, logo and video loops ship with the app (public/media)
      // and are served from Vercel's CDN, not Blob. Let players keep them
      // for a day without revalidating; a redeploy with a changed file
      // should also change the filename.
      source: '/media/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
    },
    {
      source: '/fonts/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
    },
  ],
};

export default config;
