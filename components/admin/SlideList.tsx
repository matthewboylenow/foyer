'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { templates } from '@/components/templates';
import type { Slide } from '@/lib/db/schema';

const TEMPLATE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(templates).map(([k, v]) => [k, v.label]),
);

function ScheduleBadge({ slide }: { slide: Slide }) {
  if (slide.scheduleType === 'evergreen') {
    return <span className="text-sm text-muted-foreground">Evergreen</span>;
  }
  const start = slide.startAt ? new Date(slide.startAt).toLocaleDateString('en-US') : '';
  const end = slide.endAt ? new Date(slide.endAt).toLocaleDateString('en-US') : '…';
  return <span className="text-sm text-muted-foreground">{start} – {end}</span>;
}

interface SlideListProps {
  slides: Slide[];
}

export function SlideList({ slides: initialSlides }: SlideListProps) {
  const [slides, setSlides] = useState(initialSlides);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const filtered = slides.filter((s) => {
    if (filter === 'active') return s.active;
    if (filter === 'inactive') return !s.active;
    return true;
  });

  async function toggleActive(id: string, current: boolean) {
    // Optimistic update
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
      // Revert on failure
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

  return (
    <div>
      {/* Filter chips */}
      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors capitalize ${
              filter === f
                ? 'bg-navy text-cream border-navy'
                : 'border-border text-muted-foreground hover:border-navy hover:text-navy'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {slides.length === 0 ? (
            <>
              <p className="text-lg mb-4">No slides yet</p>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Link href={'/admin/slides/new' as any} className={cn(buttonVariants(), 'bg-rust text-cream gap-2')}>
                <Plus size={16} />
                Create your first slide
              </Link>
            </>
          ) : (
            <p>No {filter} slides</p>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="w-12 px-4 py-3 text-left font-medium text-muted-foreground">On</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Template</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Schedule</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Updated</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {filtered.map((slide) => (
                  <tr
                    key={slide.id}
                    className="hover:bg-muted/40 cursor-pointer group"
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Switch
                        checked={slide.active}
                        onCheckedChange={() => toggleActive(slide.id, slide.active)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/admin/slides/${slide.id}` as any} className="font-medium text-navy hover:underline">
                        {slide.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {TEMPLATE_LABELS[slide.templateType] ?? slide.templateType}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ScheduleBadge slide={slide} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span title={new Date(slide.updatedAt).toLocaleString()}>
                        {formatDistanceToNow(new Date(slide.updatedAt), { addSuffix: true })}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => duplicateSlide(slide.id)}>
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteSlide(slide.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {filtered.map((slide) => (
              <div key={slide.id} className="border border-border rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <Link // eslint-disable-next-line @typescript-eslint/no-explicit-any
              href={`/admin/slides/${slide.id}` as any} className="font-medium text-navy">
                      {slide.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {TEMPLATE_LABELS[slide.templateType] ?? slide.templateType}
                      </Badge>
                      <ScheduleBadge slide={slide} />
                    </div>
                  </div>
                  <Switch
                    checked={slide.active}
                    onCheckedChange={() => toggleActive(slide.id, slide.active)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
