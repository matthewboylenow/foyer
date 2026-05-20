'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, GripVertical, Calendar, CheckCircle2 } from 'lucide-react';
import { templates } from '@/components/templates';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { COLLECTION_COLORS } from './CollectionPicker';
import type { Slide, SlideContent, Collection } from '@/lib/db/schema';

const TEMPLATE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(templates).map(([k, v]) => [k, v.label]),
);

// Card geometry — kept fixed so the preview scale calc is deterministic.
// Templates are designed for 1080×1920; we render them at scale = CARD_W/1080.
const CARD_W = 240;
const PREVIEW_SCALE = CARD_W / 1080;
const PREVIEW_H = 1920 * PREVIEW_SCALE; // 426.66…

export interface SlideCardData extends Slide {
  resolvedMedia?: Record<string, string>;
}

interface SlideCardProps {
  slide: SlideCardData;
  /** Optional collection metadata for the chip; passed by SlideGrid. */
  collection?: Collection | null;
  selected?: boolean;
  onSelectToggle?: (id: string) => void;
  onActiveToggle: (id: string, current: boolean) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** When true, the card is part of an active drag — slightly elevated. */
  dragging?: boolean;
  /** useSortable listeners + attributes for the drag handle. */
  dragHandleProps?: Record<string, unknown>;
}

export function SlideCard({
  slide,
  collection = null,
  selected = false,
  onSelectToggle,
  onActiveToggle,
  onDuplicate,
  onDelete,
  dragging = false,
  dragHandleProps,
}: SlideCardProps) {
  const collectionSwatch = collection
    ? COLLECTION_COLORS.find((s) => s.id === collection.color) ?? COLLECTION_COLORS[0]
    : null;
  const templateConfig = templates[slide.templateType];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TemplateComponent = templateConfig?.component as React.ComponentType<any> | undefined;
  const resolved = slide.resolvedMedia ?? {};
  const scheduleLabel =
    slide.scheduleType === 'evergreen'
      ? 'Evergreen'
      : `${slide.startAt ? new Date(slide.startAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '…'} → ${
          slide.endAt ? new Date(slide.endAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '∞'
        }`;

  return (
    <div
      className={`group relative rounded-xl bg-cream border transition-all ${
        selected
          ? 'border-rust ring-2 ring-rust/30'
          : 'border-border hover:border-navy/40 hover:shadow-md'
      } ${dragging ? 'shadow-2xl ring-2 ring-rust/40' : ''}`}
      style={{ width: CARD_W }}
    >
      {/* Selection checkbox — top-left, visible on hover or when selected */}
      {onSelectToggle && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectToggle(slide.id);
          }}
          aria-label={selected ? 'Deselect' : 'Select'}
          className={`absolute top-3 left-3 z-30 size-6 rounded-md border grid place-items-center transition-opacity ${
            selected
              ? 'opacity-100 bg-rust border-rust text-cream'
              : 'opacity-0 group-hover:opacity-100 bg-cream/90 backdrop-blur-sm border-navy/30 hover:border-navy'
          }`}
        >
          {selected && <CheckCircle2 size={14} />}
        </button>
      )}

      {/* Drag handle — top-right, on hover. */}
      {dragHandleProps && (
        <button
          type="button"
          aria-label="Drag to reorder"
          className="absolute top-3 right-3 z-30 size-6 rounded-md bg-cream/90 backdrop-blur-sm border border-navy/20 grid place-items-center text-navy/60 opacity-0 group-hover:opacity-100 hover:text-navy cursor-grab active:cursor-grabbing touch-none"
          {...dragHandleProps}
        >
          <GripVertical size={14} />
        </button>
      )}

      {/* Preview — 9:16 portrait. Renders the actual template at scaled size.
          .slide-thumb sets data-exiting so the ambient animations pause
          (defined in app/globals.css). */}
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={`/admin/slides/${slide.id}` as any}
        className="block relative overflow-hidden rounded-t-xl bg-ink"
        style={{ width: CARD_W, height: PREVIEW_H }}
      >
        {TemplateComponent && (
          <div
            className="absolute top-0 left-0 origin-top-left pointer-events-none slide-thumb"
            data-exiting="true"
            style={{
              width: 1080,
              height: 1920,
              transform: `scale(${PREVIEW_SCALE})`,
            }}
          >
            <TemplateComponent
              content={slide.content as SlideContent}
              logoUrl={resolved.logoUrl}
              bgImageUrl={resolved.bgImageUrl}
              bgVideoUrl={resolved.bgVideoUrl}
              phoneMockupUrl={resolved.phoneMockupUrl}
            />
          </div>
        )}

        {/* Inactive overlay */}
        {!slide.active && (
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="text-cream/90 text-xs uppercase tracking-widest font-medium">
              Inactive
            </span>
          </div>
        )}
      </Link>

      {/* Footer meta */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={`/admin/slides/${slide.id}` as any}
            className="flex-1 min-w-0 font-serif text-navy text-base font-semibold leading-tight hover:underline truncate"
            title={slide.title}
          >
            {slide.title || 'Untitled'}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0 p-1 -m-1 rounded hover:bg-navy/5 text-navy/40 hover:text-navy"
              aria-label="More actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onDuplicate(slide.id)}>
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => onDelete(slide.id)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-mono uppercase tracking-widest text-navy/50 truncate">
            {TEMPLATE_LABELS[slide.templateType] ?? slide.templateType}
          </span>
          <Switch
            checked={slide.active}
            onCheckedChange={() => onActiveToggle(slide.id, slide.active)}
            className="scale-75 origin-right"
            aria-label={slide.active ? 'Deactivate' : 'Activate'}
          />
        </div>

        {collection && collectionSwatch && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[10px]">
            <span className={`size-2 rounded-full ${collectionSwatch.bg}`} aria-hidden />
            <span className="font-medium text-navy/65 truncate" title={collection.name}>
              {collection.name}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-2 text-[11px] text-navy/55">
          <Calendar size={11} className="shrink-0" />
          <span className="truncate">{scheduleLabel}</span>
          <span className="ml-auto shrink-0 font-mono text-navy/40">
            {formatDistanceToNow(new Date(slide.updatedAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

export { CARD_W };
