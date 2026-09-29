'use client';

import Link from 'next/link';
import { TimeAgo } from './TimeAgo';
import {
  MoreHorizontal,
  GripVertical,
  Calendar,
  CheckCircle2,
  RectangleVertical,
  RectangleHorizontal,
} from 'lucide-react';
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
// Cards are always 240px wide; thumb height varies with the orientation
// being previewed (portrait 1080×1920 → 426.66px; landscape 1920×1080 → 135px).
const CARD_W = 240;
const PORTRAIT_THUMB_H = 1920 * (CARD_W / 1080); // 426.66
const LANDSCAPE_THUMB_H = 1080 * (CARD_W / 1920); // 135

export interface SlideCardData extends Slide {
  /** Per-orientation resolved blob URLs. Either side may be null when that
   *  orientation is unauthored. */
  resolvedMedia?: {
    portrait: Record<string, string> | null;
    landscape: Record<string, string> | null;
  };
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
  // Card shows whichever orientation is authored. For dual-orientation
  // slides, prefer portrait (denser thumb, matches the historical default).
  const portraitContent = slide.content as SlideContent;
  const landscapeContent = slide.contentLandscape as SlideContent | null;
  const portraitAuthored =
    portraitContent && typeof portraitContent === 'object' && Object.keys(portraitContent).length > 0;
  const landscapeAuthored = !!landscapeContent && Object.keys(landscapeContent as object).length > 0;
  const previewOrientation: 'portrait' | 'landscape' = portraitAuthored
    ? 'portrait'
    : landscapeAuthored
      ? 'landscape'
      : 'portrait';
  const previewContent: SlideContent | null =
    previewOrientation === 'portrait'
      ? portraitAuthored
        ? portraitContent
        : null
      : landscapeContent;
  const resolved =
    (previewOrientation === 'portrait'
      ? slide.resolvedMedia?.portrait
      : slide.resolvedMedia?.landscape) ?? {};

  const nativeW = previewOrientation === 'portrait' ? 1080 : 1920;
  const nativeH = previewOrientation === 'portrait' ? 1920 : 1080;
  const thumbH = previewOrientation === 'portrait' ? PORTRAIT_THUMB_H : LANDSCAPE_THUMB_H;
  const thumbScale = CARD_W / nativeW;
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

      {/* Preview — orientation-aware. Portrait slides render at 9:16
          (426px tall); landscape slides render at 16:9 (135px tall).
          .slide-thumb sets data-exiting so the ambient animations pause
          (defined in app/globals.css). */}
      <Link
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        href={`/admin/slides/${slide.id}` as any}
        className="block relative overflow-hidden rounded-t-xl bg-ink"
        style={{ width: CARD_W, height: thumbH }}
      >
        {TemplateComponent && previewContent && (
          <div
            className="absolute top-0 left-0 origin-top-left pointer-events-none slide-thumb"
            data-exiting="true"
            style={{
              width: nativeW,
              height: nativeH,
              transform: `scale(${thumbScale})`,
            }}
          >
            <TemplateComponent
              content={previewContent}
              orientation={previewOrientation}
              logoUrl={resolved.logoUrl}
              bgImageUrl={resolved.bgImageUrl}
              bgVideoUrl={resolved.bgVideoUrl}
              phoneMockupUrl={resolved.phoneMockupUrl}
              imageUrl={resolved.imageUrl}
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
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-mono uppercase tracking-widest text-navy/50 truncate">
              {TEMPLATE_LABELS[slide.templateType] ?? slide.templateType}
            </span>
            <OrientationPill portrait={portraitAuthored} landscape={landscapeAuthored} />
          </div>
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
          {slide.priority && (
            <span className="shrink-0 text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-rust text-cream">
              Takeover
            </span>
          )}
          <span className="truncate">{scheduleLabel}</span>
          <TimeAgo
            date={slide.updatedAt}
            className="ml-auto shrink-0 font-mono text-navy/40"
          />
        </div>
      </div>
    </div>
  );
}

export { CARD_W };

/**
 * Small pill showing which orientations this slide is authored in.
 * V = vertical only, H = horizontal only, V+H = both.
 * Exported so SlideGrid filter chips can use the same visual vocabulary.
 */
export function OrientationPill({
  portrait,
  landscape,
}: {
  portrait: boolean;
  landscape: boolean;
}) {
  if (!portrait && !landscape) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-navy/8 text-navy/60 font-medium"
      style={{ fontSize: 10 }}
      title={
        portrait && landscape
          ? 'Vertical + horizontal'
          : portrait
            ? 'Vertical only'
            : 'Horizontal only'
      }
    >
      {portrait && <RectangleVertical size={10} />}
      {landscape && <RectangleHorizontal size={10} />}
    </span>
  );
}
