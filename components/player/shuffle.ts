// Helpers operate on any slide-like type with id/updatedAt/weight — keeping
// these generic lets the player pass its own PlayerSlide shape (where Dates
// have been JSON-stringified) without fighting the SlideWithContent type.

type Weighted = { weight?: number | null };
type Pinnable = Weighted & { pin?: string | null; displayOrder?: number | null; title?: string };
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

/** Pinned slides in admin drag order (displayOrder asc, 0 = unsorted last), then title. */
function byOrder<T extends Pinnable>(a: T, b: T): number {
  const ao = a.displayOrder && a.displayOrder > 0 ? a.displayOrder : Number.MAX_SAFE_INTEGER;
  const bo = b.displayOrder && b.displayOrder > 0 ? b.displayOrder : Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return (a.title ?? '').localeCompare(b.title ?? '');
}

/**
 * One loop of the rotation: slides pinned to the start (in drag order),
 * then the weighted shuffle of everything unpinned, then slides pinned to
 * the end (in drag order). Pinned slides play exactly once per loop
 * regardless of weight, so "Welcome first, the parish slides last" holds
 * every time round.
 */
export function buildShuffledPool<T extends Pinnable>(slides: T[]): T[] {
  const start = slides.filter((s) => s.pin === 'start').sort(byOrder);
  const end = slides.filter((s) => s.pin === 'end').sort(byOrder);
  const middle = slides.filter((s) => s.pin !== 'start' && s.pin !== 'end');
  const pool = expandByWeight(middle);
  const shuffled = shuffle(pool.length > 0 ? pool : middle);
  const loop = [...start, ...shuffled, ...end];
  return loop.length > 0 ? loop : slides;
}

export function slidesHaveChanged<T extends IdAndUpdated>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return true;
  const aIds = new Set(a.map((s) => `${s.id}:${String(s.updatedAt)}`));
  for (const s of b) {
    if (!aIds.has(`${s.id}:${String(s.updatedAt)}`)) return true;
  }
  return false;
}
