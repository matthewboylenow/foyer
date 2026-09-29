'use client';

import { useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, RectangleVertical, RectangleHorizontal } from 'lucide-react';
import { useHotkey } from '@/lib/useHotkey';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { toast } from '@/lib/toast';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { templates } from '@/components/templates';
import { SlideCard, type SlideCardData } from './SlideCard';
import { COLLECTION_COLORS } from './CollectionPicker';
import type { Collection } from '@/lib/db/schema';

interface SlideGridProps {
  slides: SlideCardData[];
  collections?: Collection[];
}

type StatusFilter = 'all' | 'active' | 'inactive';
type OrientationFilter = 'all' | 'vertical' | 'horizontal';

function slideHasPortrait(s: SlideCardData): boolean {
  return !!s.content && typeof s.content === 'object' && Object.keys(s.content).length > 0;
}
function slideHasLandscape(s: SlideCardData): boolean {
  return (
    !!s.contentLandscape &&
    typeof s.contentLandscape === 'object' &&
    Object.keys(s.contentLandscape).length > 0
  );
}

const TEMPLATE_LABELS = Object.fromEntries(
  Object.entries(templates).map(([k, v]) => [k, v.label]),
);

export function SlideGrid({ slides: initialSlides, collections = [] }: SlideGridProps) {
  const router = useRouter();
  const [slides, setSlides] = useState<SlideCardData[]>(initialSlides);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [orientationFilter, setOrientationFilter] = useState<OrientationFilter>('all');
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const collectionsById = useMemo(
    () => Object.fromEntries(collections.map((c) => [c.id, c])),
    [collections],
  );

  // `/` focuses the search input. `n` creates a new slide. `Esc` clears
  // selection or search. Skips when focus is in another input.
  useHotkey('/', () => searchRef.current?.focus());
  useHotkey('n', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push('/admin/slides/new' as any);
  });
  useHotkey(
    'Escape',
    () => {
      if (selected.size > 0) setSelected(new Set());
      else if (query) {
        setQuery('');
        searchRef.current?.blur();
      }
    },
    { allowInInputs: true },
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return slides.filter((s) => {
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;
      if (orientationFilter === 'vertical' && !slideHasPortrait(s)) return false;
      if (orientationFilter === 'horizontal' && !slideHasLandscape(s)) return false;
      if (collectionFilter && s.collectionId !== collectionFilter) return false;
      if (!q) return true;
      const label = TEMPLATE_LABELS[s.templateType] ?? '';
      return (
        s.title.toLowerCase().includes(q) ||
        label.toLowerCase().includes(q) ||
        s.templateType.toLowerCase().includes(q)
      );
    });
  }, [slides, statusFilter, orientationFilter, collectionFilter, query]);

  const counts = useMemo(
    () => ({
      all: slides.length,
      active: slides.filter((s) => s.active).length,
      inactive: slides.filter((s) => !s.active).length,
    }),
    [slides],
  );

  const orientationCounts = useMemo(
    () => ({
      all: slides.length,
      vertical: slides.filter(slideHasPortrait).length,
      horizontal: slides.filter(slideHasLandscape).length,
    }),
    [slides],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(e: DragStartEvent) {
    setActiveDragId(String(e.active.id));
  }

  async function handleDragEnd(e: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(slides, oldIndex, newIndex);
    setSlides(reordered);

    try {
      const res = await fetch('/api/slides/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Order saved');
    } catch {
      // Revert on failure.
      setSlides(slides);
      toast.error("Couldn't save new order");
    }
  }

  async function toggleActive(id: string, current: boolean) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, active: !current } : s)));
    try {
      const res = await fetch(`/api/slides/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !current }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(current ? 'Slide deactivated' : 'Slide activated');
    } catch {
      setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, active: current } : s)));
      toast.error("Couldn't update slide");
    }
  }

  async function deleteSlide(id: string) {
    if (!confirm('Delete this slide? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/slides/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setSlides((prev) => prev.filter((s) => s.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Slide deleted');
    } catch {
      toast.error("Couldn't delete slide");
    }
  }

  async function duplicateSlide(id: string) {
    try {
      const slide = slides.find((s) => s.id === id);
      if (!slide) return;
      const res = await fetch('/api/slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...slide,
          id: undefined,
          title: `${slide.title} (copy)`,
          active: false,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const created = await res.json();
      setSlides((prev) => [created, ...prev]);
      toast.success('Slide duplicated');
    } catch {
      toast.error("Couldn't duplicate slide");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkSetActive(makeActive: boolean) {
    const ids = Array.from(selected);
    setSlides((prev) =>
      prev.map((s) => (selected.has(s.id) ? { ...s, active: makeActive } : s)),
    );
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/slides/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: makeActive }),
          }),
        ),
      );
      toast.success(`${ids.length} ${makeActive ? 'activated' : 'deactivated'}`);
      setSelected(new Set());
    } catch {
      toast.error("Couldn't update slides");
    }
  }

  async function bulkSetActiveForCollection(collectionId: string, makeActive: boolean) {
    // Optimistic: flip every slide whose collectionId matches.
    const affectedIds = slides.filter((s) => s.collectionId === collectionId).map((s) => s.id);
    setSlides((prev) =>
      prev.map((s) => (s.collectionId === collectionId ? { ...s, active: makeActive } : s)),
    );
    try {
      const res = await fetch(`/api/collections/${collectionId}/active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: makeActive }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(
        `${affectedIds.length} slide${affectedIds.length === 1 ? '' : 's'} ${
          makeActive ? 'activated' : 'deactivated'
        }`,
      );
    } catch {
      // Revert
      setSlides((prev) =>
        prev.map((s) =>
          s.collectionId === collectionId ? { ...s, active: !makeActive } : s,
        ),
      );
      toast.error("Couldn't update collection");
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} slide${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    try {
      await Promise.all(ids.map((id) => fetch(`/api/slides/${id}`, { method: 'DELETE' })));
      setSlides((prev) => prev.filter((s) => !selected.has(s.id)));
      setSelected(new Set());
      toast.success(`${ids.length} deleted`);
    } catch {
      toast.error("Couldn't delete slides");
    }
  }

  if (slides.length === 0) {
    return (
      <div className="text-center py-24 px-4 rounded-2xl border border-dashed border-navy/20 bg-cream/50">
        <div className="text-5xl mb-3 font-serif text-navy/30">∅</div>
        <p className="font-serif text-2xl text-navy mb-2">No slides yet</p>
        <p className="text-navy/60 mb-6 max-w-md mx-auto">
          Build your first slide — start with a Parish Identity headline, or paste in this week&apos;s
          Mass intentions.
        </p>
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={'/admin/slides/new' as any}
          className={cn(buttonVariants(), 'bg-rust hover:bg-rust-700 text-cream gap-2')}
        >
          <Plus size={16} />
          Create your first slide
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Takeover banner — whichever slides are priority are the only ones on screen. */}
      {slides.some((s) => s.active && s.priority) && (
        <div className="rounded-lg border border-rust/40 bg-rust/5 px-4 py-2.5 text-sm text-navy flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-rust text-cream">
            Takeover on
          </span>
          <span>
            {slides.filter((s) => s.active && s.priority).map((s) => s.title || 'Untitled').join(', ')}
            {' '}— the TVs show only these until the takeover is turned off or expires.
          </span>
        </div>
      )}

      {/* Filter + search row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 p-1 rounded-lg bg-navy/5 border border-navy/10">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                statusFilter === f
                  ? 'bg-cream text-navy shadow-sm'
                  : 'text-navy/60 hover:text-navy'
              }`}
            >
              {f}
              <span className="ml-1.5 font-mono text-[11px] text-navy/40">{counts[f]}</span>
            </button>
          ))}
        </div>

        {/* Orientation filter — V/H + counts. Hidden when every slide is
            vertical (the historical state) to avoid clutter. */}
        {orientationCounts.horizontal > 0 && (
          <div className="flex gap-1.5 p-1 rounded-lg bg-navy/5 border border-navy/10">
            <button
              onClick={() => setOrientationFilter('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                orientationFilter === 'all'
                  ? 'bg-cream text-navy shadow-sm'
                  : 'text-navy/60 hover:text-navy'
              }`}
            >
              Both
              <span className="ml-1.5 font-mono text-[11px] text-navy/40">
                {orientationCounts.all}
              </span>
            </button>
            <button
              onClick={() => setOrientationFilter('vertical')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                orientationFilter === 'vertical'
                  ? 'bg-cream text-navy shadow-sm'
                  : 'text-navy/60 hover:text-navy'
              }`}
              aria-label="Filter to vertical slides"
            >
              <RectangleVertical size={13} />
              <span className="font-mono text-[11px] text-navy/40">
                {orientationCounts.vertical}
              </span>
            </button>
            <button
              onClick={() => setOrientationFilter('horizontal')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                orientationFilter === 'horizontal'
                  ? 'bg-cream text-navy shadow-sm'
                  : 'text-navy/60 hover:text-navy'
              }`}
              aria-label="Filter to horizontal slides"
            >
              <RectangleHorizontal size={13} />
              <span className="font-mono text-[11px] text-navy/40">
                {orientationCounts.horizontal}
              </span>
            </button>
          </div>
        )}

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40 pointer-events-none"
          />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or template…"
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-navy/15 bg-cream focus:outline-none focus:border-navy focus:ring-2 focus:ring-rust/20"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-navy/40 hover:text-navy"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="hidden sm:inline absolute -right-7 top-1/2 -translate-y-1/2 text-[10px] font-mono text-navy/30 select-none">
            /
          </kbd>
        </div>

        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={'/admin/slides/new' as any}
          className={cn(
            buttonVariants(),
            'ml-auto bg-rust hover:bg-rust-700 text-cream gap-2',
          )}
        >
          <Plus size={16} />
          New slide
        </Link>
      </div>

      {/* Collection filter row — only when there are collections to filter by */}
      {collections.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCollectionFilter(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              collectionFilter === null
                ? 'border-navy bg-navy text-cream'
                : 'border-navy/15 text-navy/65 hover:border-navy/40 hover:text-navy'
            }`}
          >
            All collections
          </button>
          {collections.map((c) => {
            const swatch = COLLECTION_COLORS.find((sw) => sw.id === c.color) ?? COLLECTION_COLORS[0];
            const active = collectionFilter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCollectionFilter(active ? null : c.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'border-navy bg-navy text-cream'
                    : 'border-navy/15 text-navy/70 hover:border-navy/40 hover:text-navy'
                }`}
              >
                <span className={`size-2 rounded-full ${swatch.bg}`} aria-hidden />
                {c.name}
              </button>
            );
          })}
          {collectionFilter && (
            <div className="ml-2 inline-flex items-center gap-2 text-xs">
              <button
                onClick={() => bulkSetActiveForCollection(collectionFilter, true)}
                className="px-2.5 py-1 rounded-md bg-gold/15 text-gold hover:bg-gold/25 font-medium"
              >
                Activate pack
              </button>
              <button
                onClick={() => bulkSetActiveForCollection(collectionFilter, false)}
                className="px-2.5 py-1 rounded-md bg-navy/5 text-navy/70 hover:bg-navy/10 font-medium"
              >
                Deactivate pack
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-navy text-cream text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => bulkSetActive(true)}
              className="px-3 py-1 rounded-md bg-cream/10 hover:bg-cream/15"
            >
              Activate
            </button>
            <button
              onClick={() => bulkSetActive(false)}
              className="px-3 py-1 rounded-md bg-cream/10 hover:bg-cream/15"
            >
              Deactivate
            </button>
            <button
              onClick={bulkDelete}
              className="px-3 py-1 rounded-md bg-rust hover:bg-rust-700 text-cream"
            >
              Delete
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="p-1 rounded-md hover:bg-cream/10"
              aria-label="Clear selection"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-navy/50">
          No {statusFilter === 'all' ? '' : statusFilter} slides match{' '}
          {query ? <span className="text-navy">&ldquo;{query}&rdquo;</span> : 'this filter'}.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filtered.map((s) => s.id)} strategy={rectSortingStrategy}>
            <div
              className="grid gap-5"
              style={{ gridTemplateColumns: 'repeat(auto-fill, 240px)' }}
            >
              {filtered.map((slide) => {
                const coll = slide.collectionId ? collectionsById[slide.collectionId] ?? null : null;
                return (
                  <SortableSlideCard
                    key={slide.id}
                    slide={slide}
                    collection={coll}
                    selected={selected.has(slide.id)}
                    onSelectToggle={toggleSelect}
                    onActiveToggle={toggleActive}
                    onDuplicate={duplicateSlide}
                    onDelete={deleteSlide}
                    isActiveDrag={activeDragId === slide.id}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// Sortable wrapper — applies useSortable's transform and passes the handle
// listeners through to SlideCard's grip button.
function SortableSlideCard({
  slide,
  collection,
  selected,
  onSelectToggle,
  onActiveToggle,
  onDuplicate,
  onDelete,
  isActiveDrag,
}: {
  slide: SlideCardData;
  collection: Collection | null;
  selected: boolean;
  onSelectToggle: (id: string) => void;
  onActiveToggle: (id: string, current: boolean) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isActiveDrag: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isActiveDrag ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SlideCard
        slide={slide}
        collection={collection}
        selected={selected}
        onSelectToggle={onSelectToggle}
        onActiveToggle={onActiveToggle}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        dragging={isActiveDrag}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
