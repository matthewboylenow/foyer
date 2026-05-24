// Helpers operate on any slide-like type with id/updatedAt/weight — keeping
// these generic lets the player pass its own PlayerSlide shape (where Dates
// have been JSON-stringified) without fighting the SlideWithContent type.

type Weighted = { weight?: number | null };
type IdAndUpdated = { id: string; updatedAt: string | Date };

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function expandByWeight<T extends Weighted>(slides: T[]): T[] {
  const pool: T[] = [];
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

export function buildShuffledPool<T extends Weighted>(slides: T[]): T[] {
  const pool = expandByWeight(slides);
  return shuffle(pool.length > 0 ? pool : slides);
}

export function slidesHaveChanged<T extends IdAndUpdated>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return true;
  const aIds = new Set(a.map((s) => `${s.id}:${String(s.updatedAt)}`));
  for (const s of b) {
    if (!aIds.has(`${s.id}:${String(s.updatedAt)}`)) return true;
  }
  return false;
}
