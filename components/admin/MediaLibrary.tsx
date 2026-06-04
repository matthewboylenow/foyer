'use client';

import { useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Search, Trash2, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Media } from '@/lib/db/schema';

type SerializedMedia = Omit<Media, 'uploadedAt'> & { uploadedAt: string };

interface MediaLibraryProps {
  initialItems: SerializedMedia[];
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaLibrary({ initialItems }: MediaLibraryProps) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(m: SerializedMedia) {
    if (deletingId) return;
    if (!confirm(`Delete "${m.filename}"? This cannot be undone.`)) return;
    setDeletingId(m.id);
    try {
      const res = await fetch(`/api/media/${m.id}`, { method: 'DELETE' });
      if (res.status === 409) {
        const body = (await res.json()) as {
          slides?: { id: string; title: string }[];
          usedBySettings?: boolean;
        };
        const titles = body.slides?.map((s) => `"${s.title}"`).join(', ') ?? '';
        const parts = [
          titles && `still used by ${titles}`,
          body.usedBySettings && 'set as the parish default logo',
        ].filter(Boolean);
        toast.error(`Can't delete — ${parts.join(' and ')}`);
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      setItems((prev) => prev.filter((x) => x.id !== m.id));
      toast.success('Deleted');
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = items.filter((m) =>
    m.filename.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by filename…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'image' : 'images'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-md">
          <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {items.length === 0
              ? 'No images yet — upload one from a slide and it will appear here.'
              : 'No matches for that search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="border border-border rounded-md bg-muted/20 overflow-hidden flex flex-col"
            >
              <div className="relative aspect-square p-3 bg-muted/30">
                {/* next/image downscales blob originals so the library grid
                    doesn't stream full-res files on every page view. */}
                <Image
                  src={m.blobUrl}
                  alt={m.filename}
                  fill
                  sizes="(min-width: 1024px) 300px, (min-width: 640px) 33vw, 50vw"
                  className="object-contain p-3"
                  unoptimized={m.blobUrl.endsWith('.svg')}
                />
              </div>
              <div className="p-2 border-t border-border space-y-1">
                <div className="text-xs font-medium truncate" title={m.filename}>
                  {m.filename}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {m.type}
                    {m.bytes ? ` · ${formatBytes(m.bytes)}` : ''}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(m)}
                    disabled={deletingId === m.id}
                    className="text-muted-foreground hover:text-rust"
                    aria-label={`Delete ${m.filename}`}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
