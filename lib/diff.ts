/**
 * Compute a field-level diff between a previous and next object.
 * Returns null for fields whose values are deeply equal, an object
 * `{ from, to }` for fields that changed.
 *
 * For nested objects (content jsonb), we recursively diff and store
 * only the sub-fields that actually changed — keeps the audit row
 * small and the UI render clean.
 */
export interface FieldDiff {
  from: unknown;
  to: unknown;
}
export interface ObjectDiff {
  [key: string]: FieldDiff | ObjectDiff;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!deepEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

/**
 * Returns the keys present in either object whose values differ, mapped
 * to either a flat `{from, to}` or, for nested objects, a nested ObjectDiff.
 * Keys whose values are unchanged are omitted.
 */
export function diffObjects(prev: Record<string, unknown>, next: Record<string, unknown>): ObjectDiff {
  const out: ObjectDiff = {};
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    const a = prev[k];
    const b = next[k];
    if (deepEqual(a, b)) continue;
    if (isPlainObject(a) && isPlainObject(b)) {
      const sub = diffObjects(a, b);
      if (Object.keys(sub).length > 0) out[k] = sub;
    } else {
      // Normalize undefined → null so JSONB round-tripping doesn't drop the
      // key. Without this, a newly-added field produces `{ to: x }` (no
      // `from`), which downstream code can't distinguish from a corrupted
      // diff.
      out[k] = { from: a === undefined ? null : a, to: b === undefined ? null : b };
    }
  }
  return out;
}

/**
 * Type guard for narrowing audit metadata's `changes` field at the UI layer.
 * Accepts partial diffs (only one of `from`/`to`) — legacy audit rows lost
 * the `undefined` side during JSONB serialization before the write-side fix.
 */
export function isFieldDiff(v: unknown): v is FieldDiff {
  return isPlainObject(v) && ('from' in v || 'to' in v);
}
