'use client';

import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { Collection, CollectionColor } from '@/lib/db/schema';

const COLORS: { id: CollectionColor; bg: string; ring: string; label: string }[] = [
  { id: 'rust', bg: 'bg-rust', ring: 'ring-rust', label: 'Rust' },
  { id: 'gold', bg: 'bg-gold', ring: 'ring-gold', label: 'Gold' },
  { id: 'navy', bg: 'bg-navy', ring: 'ring-navy', label: 'Navy' },
  { id: 'sage', bg: 'bg-emerald-600', ring: 'ring-emerald-600', label: 'Sage' },
  { id: 'plum', bg: 'bg-purple-700', ring: 'ring-purple-700', label: 'Plum' },
  { id: 'sky', bg: 'bg-sky-600', ring: 'ring-sky-600', label: 'Sky' },
];

interface Props {
  collections: Collection[];
  /** Currently-selected collection id, or null/undefined for "no collection". */
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  /** Called when a new collection is created server-side, so the parent can
   *  add it to its list without a page reload. */
  onCollectionCreated: (collection: Collection) => void;
}

export function CollectionPicker({
  collections,
  value,
  onChange,
  onCollectionCreated,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<CollectionColor>('rust');
  const [saving, setSaving] = useState(false);

  async function createCollection() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (!res.ok) throw new Error('Failed');
      const created: Collection = await res.json();
      onCollectionCreated(created);
      onChange(created.id);
      setNewName('');
      setNewColor('rust');
      setCreating(false);
      toast.success(`"${created.name}" created`);
    } catch {
      toast.error("Couldn't create collection");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Collection</Label>
      {!creating ? (
        <div className="space-y-2">
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">— None —</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 text-xs text-rust hover:text-rust-700"
          >
            <Plus size={12} />
            New collection
          </button>
        </div>
      ) : (
        <div className="space-y-2 p-3 rounded-md bg-navy/[0.03] border border-navy/10">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Easter Triduum"
            onKeyDown={(e) => e.key === 'Enter' && createCollection()}
            autoFocus
          />
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-label={c.label}
                onClick={() => setNewColor(c.id)}
                className={`size-6 rounded-full ${c.bg} grid place-items-center transition-all ${
                  newColor === c.id ? `ring-2 ring-offset-2 ${c.ring} ring-offset-cream` : ''
                }`}
              >
                {newColor === c.id && <Check size={12} className="text-cream" />}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={createCollection}
              disabled={saving || !newName.trim()}
              className="px-3 py-1 text-xs rounded-md bg-rust text-cream hover:bg-rust-700 disabled:opacity-50"
            >
              {saving ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewName('');
              }}
              className="px-2 py-1 text-xs text-navy/60 hover:text-navy inline-flex items-center gap-1"
            >
              <X size={12} />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const COLLECTION_COLORS = COLORS;
