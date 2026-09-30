import { describe, it, expect } from 'vitest';
import { buildShuffledPool } from '@/components/player/shuffle';

const s = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id, weight: 1, pin: null, displayOrder: 0, ...extra });

describe('buildShuffledPool with pins', () => {
  it('puts start pins first and end pins last, in drag order', () => {
    const slides = [
      s('candle', { pin: 'end', displayOrder: 30 }),
      s('a'), s('b'), s('c'),
      s('welcome', { pin: 'start', displayOrder: 10 }),
      s('intentions', { pin: 'end', displayOrder: 10 }),
      s('association', { pin: 'end', displayOrder: 20 }),
    ];
    for (let i = 0; i < 20; i++) {
      const loop = buildShuffledPool(slides).map((x) => x.id);
      expect(loop[0]).toBe('welcome');
      expect(loop.slice(-3)).toEqual(['intentions', 'association', 'candle']);
      expect(loop.slice(1, -3).sort()).toEqual(['a', 'b', 'c']);
    }
  });

  it('plays pinned slides once per loop regardless of weight', () => {
    const loop = buildShuffledPool([s('welcome', { pin: 'start', weight: 3 }), s('x', { weight: 2 })]).map((x) => x.id);
    expect(loop.filter((id) => id === 'welcome')).toHaveLength(1);
    expect(loop.filter((id) => id === 'x')).toHaveLength(2);
  });

  it('still works with only pinned slides', () => {
    const loop = buildShuffledPool([s('end', { pin: 'end' }), s('start', { pin: 'start' })]).map((x) => x.id);
    expect(loop).toEqual(['start', 'end']);
  });
});
