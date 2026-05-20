import type { SlideWithContent } from '@/lib/db/schema';

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function expandByWeight(slides: SlideWithContent[]): SlideWithContent[] {
  const pool: SlideWithContent[] = [];
  for (const s of slides) {
    const w = s.weight ?? 1;
    if (w >= 1) {
      for (let i = 0; i < Math.round(w); i++) pool.push(s);
    } else {
      if (Math.random() < w) pool.push(s);
    }
  }
  return pool;
}

export function buildShuffledPool(slides: SlideWithContent[]): SlideWithContent[] {
  const pool = expandByWeight(slides);
  return shuffle(pool.length > 0 ? pool : slides);
}

export function slidesHaveChanged(a: SlideWithContent[], b: SlideWithContent[]): boolean {
  if (a.length !== b.length) return true;
  const aIds = new Set(a.map((s) => `${s.id}:${s.updatedAt}`));
  for (const s of b) {
    if (!aIds.has(`${s.id}:${s.updatedAt}`)) return true;
  }
  return false;
}
