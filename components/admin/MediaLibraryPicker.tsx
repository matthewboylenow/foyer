'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Search, Trash2, ImageIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Media } from '@/lib/db/schema';

type LibraryFilter = 'image' | 'logo' | 'video' | 'image-or-logo';

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MediaLibraryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which media types appear in the grid. Defaults to images + logos. */
  filter?: LibraryFilter;
  /** Called when the user clicks a tile. Closes the dialog automatically. */
  onSelect: (media: Pick<Media, 'id' | 'blobUrl' | 'filename'>) => void;
}

export function MediaLibraryPicker({
  open,
  onOpenChange,
  filter = 'image-or-logo',
  onSelect,
}: MediaLibraryPickerProps) {
  const [items, setItems] = useState<Media[] | null>(null);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems(null);
    fetch(`/api/media?type=${filter}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: Media[]) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(`Failed to load library: ${err}`);
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, filter]);

  async function handleDelete(m: Media) {
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
      setItems((prev) => prev?.filter((x) => x.id !== m.id) ?? null);
      toast.success('Deleted');
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = items?.filter((m) =>
    m.filename.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => onOpenChange(o)}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose from library</DialogTitle>
          <DialogDescription>
            Reuse an image you&apos;ve already uploaded — no need to re-upload the same file.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by filename…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="overflow-y-auto -mx-4 px-4 flex-1 min-h-0">
          {items === null ? (
            <div className="text-center text-sm text-muted-foreground py-10">Loading…</div>
          ) : filtered && filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {items.length === 0
                  ? 'No images yet — upload one and it will appear here.'
                  : 'No matches for that search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-2">
              {filtered?.map((m) => (
                <div
                  key={m.id}
                  className="group relative border border-border rounded-md bg-muted/30 overflow-hidden hover:border-navy transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({ id: m.id, blobUrl: m.blobUrl, filename: m.filename });
                      onOpenChange(false);
                    }}
                    className="relative block w-full aspect-square p-2"
                  >
                    {/* next/image downscales blob originals so opening the
                        picker doesn't stream full-res files. */}
                    <Image
                      src={m.blobUrl}
                      alt={m.filename}
                      fill
                      sizes="(min-width: 768px) 180px, (min-width: 640px) 33vw, 50vw"
                      className="object-contain p-2"
                      unoptimized={m.blobUrl.endsWith('.svg')}
                    />
                  </button>
                  <div className="px-2 py-1.5 border-t border-border bg-background/80 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground truncate flex-1" title={m.filename}>
                      {m.filename}
                      {m.bytes ? ` · ${formatBytes(m.bytes)}` : ''}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(m);
                      }}
                      disabled={deletingId === m.id}
                      className="text-muted-foreground hover:text-rust"
                      aria-label={`Delete ${m.filename}`}
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
