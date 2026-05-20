'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { templates } from '@/components/templates';
import { COLLECTION_COLORS } from './CollectionPicker';
import type { Collection } from '@/lib/db/schema';

interface ScheduleSlide {
  id: string;
  title: string;
  templateType: string;
  scheduleType: 'evergreen' | 'dated';
  startAt: string | null;
  endAt: string | null;
  active: boolean;
  collectionId: string | null;
}

interface Props {
  slides: ScheduleSlide[];
  collections: Collection[];
}

// Timeline geometry.
const DAY_WIDTH = 56; // px per day column
const ROW_HEIGHT = 40;
const ROW_GAP = 6;
const VISIBLE_DAYS = 56; // 8 weeks
const HEADER_HEIGHT = 56;

const TEMPLATE_LABELS = Object.fromEntries(
  Object.entries(templates).map(([k, v]) => [k, v.label]),
);

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function diffDays(a: Date, b: Date) {
  // Whole-day diff ignoring time component — already normalized by startOfDay.
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function ScheduleTimeline({ slides, collections }: Props) {
  const [originIndex, setOriginIndex] = useState(0); // weeks offset from today
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  // Origin = the Sunday on or before "today + offset weeks".
  const origin = useMemo(() => {
    const base = addDays(today, originIndex * 7);
    return addDays(base, -base.getDay());
  }, [today, originIndex]);

  const days = useMemo(
    () => Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(origin, i)),
    [origin],
  );

  const collectionsById = useMemo(
    () => Object.fromEntries(collections.map((c) => [c.id, c])),
    [collections],
  );

  // Partition slides into evergreen vs dated visible in the window.
  const evergreen = slides.filter((s) => s.scheduleType === 'evergreen' && s.active);

  const dated = useMemo(() => {
    const end = addDays(origin, VISIBLE_DAYS);
    return slides
      .filter((s) => s.scheduleType === 'dated')
      .map((s) => {
        // "Open-ended" treatments: missing startAt = origin, missing endAt = far future
        const start = s.startAt ? startOfDay(new Date(s.startAt)) : origin;
        const finish = s.endAt ? startOfDay(new Date(s.endAt)) : addDays(end, 365);
        return { ...s, _start: start, _end: finish };
      })
      .filter((s) => s._end >= origin && s._start < end)
      .sort((a, b) => a._start.getTime() - b._start.getTime());
  }, [slides, origin]);

  // Auto-scroll so "today" sits ~25% from the left on initial render.
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayCol = diffDays(today, origin);
    const target = Math.max(0, todayCol * DAY_WIDTH - scrollRef.current.clientWidth * 0.25);
    scrollRef.current.scrollLeft = target;
  }, [today, origin]);

  // Group day columns into weeks for the top axis.
  const weeks: { start: Date; days: Date[] }[] = [];
  for (let i = 0; i < VISIBLE_DAYS; i += 7) {
    weeks.push({ start: days[i], days: days.slice(i, i + 7) });
  }

  const todayCol = diffDays(today, origin);
  const todayX = todayCol >= 0 && todayCol < VISIBLE_DAYS ? todayCol * DAY_WIDTH : null;

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOriginIndex(0)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-navy text-cream hover:bg-navy-700"
        >
          <Calendar size={14} />
          Today
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOriginIndex((n) => n - 4)}
            className="size-8 rounded-md border border-navy/15 hover:border-navy/40 hover:bg-navy/5 grid place-items-center text-navy/60"
            aria-label="Back 4 weeks"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setOriginIndex((n) => n + 4)}
            className="size-8 rounded-md border border-navy/15 hover:border-navy/40 hover:bg-navy/5 grid place-items-center text-navy/60"
            aria-label="Forward 4 weeks"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="text-sm text-navy/55">
          <span className="font-mono">
            {MONTH_NAMES[origin.getMonth()]} {origin.getDate()}
          </span>
          <span className="mx-2 text-navy/30">→</span>
          <span className="font-mono">
            {MONTH_NAMES[days[VISIBLE_DAYS - 1].getMonth()]} {days[VISIBLE_DAYS - 1].getDate()}
          </span>
        </div>
        <div className="ml-auto inline-flex items-center gap-3 text-[11px] text-navy/55">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rust" /> Dated
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-navy/30" /> Inactive
          </span>
        </div>
      </div>

      {/* Always-playing lane */}
      <div className="rounded-xl border border-navy/10 bg-cream p-4">
        <div className="text-[10px] uppercase tracking-widest text-navy/45 font-medium mb-2">
          Always playing
        </div>
        {evergreen.length === 0 ? (
          <p className="text-sm text-navy/45 italic">No evergreen slides active.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {evergreen.map((s) => {
              const coll = s.collectionId ? collectionsById[s.collectionId] : null;
              const sw = coll
                ? COLLECTION_COLORS.find((x) => x.id === coll.color) ?? COLLECTION_COLORS[0]
                : null;
              return (
                <Link
                  key={s.id}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={`/admin/slides/${s.id}` as any}
                  className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-navy/15 bg-cream hover:border-navy/40 text-sm"
                  title={`${s.title} · ${TEMPLATE_LABELS[s.templateType] ?? s.templateType}`}
                >
                  {sw && <span className={`size-2 rounded-full ${sw.bg}`} aria-hidden />}
                  <span className="text-navy font-medium truncate max-w-[16ch]">{s.title}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-navy/40">
                    {TEMPLATE_LABELS[s.templateType] ?? s.templateType}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Timeline scroller */}
      <div className="rounded-xl border border-navy/10 bg-cream overflow-hidden">
        <div ref={scrollRef} className="overflow-x-auto">
          <div
            className="relative"
            style={{
              width: VISIBLE_DAYS * DAY_WIDTH,
              minHeight: HEADER_HEIGHT + Math.max(dated.length, 2) * (ROW_HEIGHT + ROW_GAP) + 24,
            }}
          >
            {/* Today vertical guide */}
            {todayX !== null && (
              <div
                className="absolute top-0 bottom-0 z-10 pointer-events-none"
                style={{ left: todayX, width: DAY_WIDTH }}
              >
                <div className="h-full bg-rust/5" />
                <div className="absolute top-0 bottom-0 left-0 w-px bg-rust/40" />
                <div className="absolute top-1 left-1 text-[9px] font-medium uppercase tracking-widest text-rust">
                  Today
                </div>
              </div>
            )}

            {/* Week header row */}
            <div
              className="sticky top-0 z-20 grid border-b border-navy/10 bg-cream"
              style={{
                gridTemplateColumns: `repeat(${VISIBLE_DAYS}, ${DAY_WIDTH}px)`,
                height: HEADER_HEIGHT,
              }}
            >
              {days.map((d, i) => {
                const isFirstOfMonth = d.getDate() === 1;
                const isWeekStart = d.getDay() === 0;
                return (
                  <div
                    key={i}
                    className={`relative px-2 py-2 flex flex-col justify-between text-[10px] ${
                      isWeekStart ? 'border-l border-navy/15' : 'border-l border-navy/[0.04]'
                    }`}
                  >
                    {isFirstOfMonth && (
                      <div className="font-mono uppercase tracking-widest text-navy/65 font-semibold">
                        {MONTH_NAMES[d.getMonth()]}
                      </div>
                    )}
                    {isWeekStart && !isFirstOfMonth && (
                      <div className="font-mono uppercase tracking-widest text-navy/40">
                        {MONTH_NAMES[d.getMonth()]} {d.getDate()}
                      </div>
                    )}
                    <div className="font-mono text-navy/40">{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {/* Slide bars */}
            <div className="relative p-3" style={{ paddingTop: 12 }}>
              {dated.length === 0 ? (
                <div className="text-sm text-navy/45 italic px-2 py-6">
                  No dated slides in this window.
                </div>
              ) : (
                dated.map((s, idx) => {
                  // Clip the bar to the visible window.
                  const startCol = Math.max(0, diffDays(s._start, origin));
                  const endCol = Math.min(VISIBLE_DAYS, diffDays(s._end, origin) + 1);
                  const left = startCol * DAY_WIDTH;
                  const width = Math.max(DAY_WIDTH, (endCol - startCol) * DAY_WIDTH);

                  const coll = s.collectionId ? collectionsById[s.collectionId] : null;
                  const sw = coll
                    ? COLLECTION_COLORS.find((x) => x.id === coll.color) ?? COLLECTION_COLORS[0]
                    : COLLECTION_COLORS[0];
                  const inactive = !s.active;
                  const openEnded = !s.endAt;
                  const openStart = !s.startAt;

                  return (
                    <Link
                      key={s.id}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      href={`/admin/slides/${s.id}` as any}
                      className="absolute group"
                      style={{
                        left,
                        width,
                        top: idx * (ROW_HEIGHT + ROW_GAP),
                        height: ROW_HEIGHT,
                      }}
                      title={`${s.title} · ${s.startAt ? new Date(s.startAt).toLocaleDateString() : 'no start'} → ${
                        s.endAt ? new Date(s.endAt).toLocaleDateString() : 'open-ended'
                      }`}
                    >
                      <div
                        className={`relative h-full rounded-md overflow-hidden flex items-center px-3 transition-all ${
                          inactive
                            ? 'bg-navy/20 text-navy/55 hover:bg-navy/30'
                            : `${sw.bg} text-cream hover:brightness-110`
                        } shadow-sm`}
                      >
                        {/* Open-start indicator (fades left edge) */}
                        {openStart && startCol === 0 && (
                          <div className="absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-cream/40 to-transparent pointer-events-none" />
                        )}
                        {/* Open-end indicator (fades right edge) */}
                        {openEnded && endCol === VISIBLE_DAYS && (
                          <div className="absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-cream/40 to-transparent pointer-events-none" />
                        )}
                        <div className="relative z-10 flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-sm truncate">{s.title}</span>
                          <span className="font-mono text-[10px] uppercase tracking-widest opacity-70 truncate">
                            {TEMPLATE_LABELS[s.templateType] ?? s.templateType}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
