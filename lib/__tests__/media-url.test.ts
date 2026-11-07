import { describe, it, expect } from 'vitest';
import { isBlobMediaUrl, isBundledMediaUrl, isOwnMediaUrl } from '../media-url';

describe('media URLs', () => {
  it('recognizes bundled files under /media', () => {
    expect(isBundledMediaUrl('/media/advent-glow-joy-candle.jpg')).toBe(true);
    expect(isBundledMediaUrl('/media/hero-2026-portrait.mp4')).toBe(true);
    expect(isBundledMediaUrl('/media/../secret')).toBe(false);
    expect(isBundledMediaUrl('/media/')).toBe(false);
    expect(isBundledMediaUrl('media/x.jpg')).toBe(false);
  });

  it('recognizes this project\'s Blob store and nothing else', () => {
    expect(isBlobMediaUrl('https://ackicilpcfcjcfbb.public.blob.vercel-storage.com/App%20Slide.jpg')).toBe(true);
    expect(isBlobMediaUrl('https://example.com/x.jpg')).toBe(false);
    expect(isOwnMediaUrl('https://evil.example/public.blob.vercel-storage.com/x')).toBe(false);
    expect(isOwnMediaUrl('/media/logo.png')).toBe(true);
  });
});
