'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { TimeAgo } from './TimeAgo';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  Folder,
  ArrowRight,
} from 'lucide-react';
import { isFieldDiff, type FieldDiff, type ObjectDiff } from '@/lib/diff';

interface AuditRow {
  id: string;
  userEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  createdAt: string;
}

interface Props {
  entries: AuditRow[];
  slideTitles: Record<string, { title: string; templateType: string }>;
}

interface ActionMeta {
  label: string;
  icon: typeof Plus;
  tint: string;
}

const ACTION_META: Record<string, ActionMeta> = {
  'slide.create': { label: 'Created slide', icon: Plus, tint: 'bg-emerald-500/15 text-emerald-700' },
  'slide.update': { label: 'Edited slide', icon: Pencil, tint: 'bg-navy/10 text-navy' },
  'slide.delete': { label: 'Deleted slide', icon: Trash2, tint: 'bg-rust/15 text-rust' },
  'slide.toggle': { label: 'Toggled slide', icon: ToggleLeft, tint: 'bg-amber-500/15 text-amber-800' },
  'slide.reorder': { label: 'Reordered slides', icon: ToggleLeft, tint: 'bg-navy/10 text-navy' },
  'collection.create': { label: 'Created collection', icon: Folder, tint: 'bg-emerald-500/15 text-emerald-700' },
  'collection.update': { label: 'Edited collection', icon: Pencil, tint: 'bg-navy/10 text-navy' },
  'collection.delete': { label: 'Deleted collection', icon: Trash2, tint: 'bg-rust/15 text-rust' },
  'collection.activate': { label: 'Activated pack', icon: ToggleLeft, tint: 'bg-emerald-500/15 text-emerald-700' },
  'collection.deactivate': { label: 'Deactivated pack', icon: ToggleLeft, tint: 'bg-amber-500/15 text-amber-800' },
};

// Field labels for the diff renderer — only the ones a parish editor would
// recognize. Unknown keys fall back to the raw name.
const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  active: 'Showing on TVs',
  weight: 'How often to show',
  durationOverrideSec: 'Time on screen (sec)',
  scheduleType: 'When to show',
  startAt: 'Starts',
  endAt: 'Ends',
  targetDisplays: 'Which TVs',
  collectionId: 'Collection',
  displayOrder: 'Order in list',
  // content children
  headline: 'Headline',
  subline: 'Tagline',
  body: 'Body',
  quote: 'Quote',
  attribution: 'Attribution',
  meta: 'Date, time & location',
  name: 'Name',
  names: 'Names',
  inMemoryOf: 'In memory of',
  url: 'URL',
  weekendLabel: 'Weekend label',
  weekendRows: 'Weekend rows',
  weekdayRows: 'Weekday rows',
  rows: 'Rows',
  scheduleKind: 'Schedule kind',
  motionStyle: 'Headline animation',
  textMode: 'Text style',
  headlineSize: 'Headline size',
  quoteSize: 'Quote size',
  nameSize: 'Name size',
  logoSize: 'Logo size',
  bgImageMediaId: 'Background image',
  bgVideoMediaId: 'Background video',
  logoMediaId: 'Logo',
  phoneMockupMediaId: 'Phone mockup',
};

function fieldLabel(key: string) {
  return FIELD_LABELS[key] ?? key;
}

// Pretty-print a single value for the diff column. Handles the common
// types we actually store: strings, booleans, dates, ids, arrays.
function valueToString(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'On' : 'Off';
  if (typeof v === 'string') {
    if (v.length === 0) return '(empty)';
    // ISO date string?
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    }
    // Likely a UUID — show first 8 chars
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v)) return v.slice(0, 8) + '…';
    return v.length > 80 ? v.slice(0, 80) + '…' : v;
  }
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toLocaleString();
  if (Array.isArray(v)) {
    if (v.length === 0) return '(none)';
    if (v.length <= 4) return v.map(valueToString).join(', ');
    return `${v.length} items`;
  }
  if (typeof v === 'object') {
    try {
      const json = JSON.stringify(v);
      return json.length > 80 ? json.slice(0, 80) + '…' : json;
    } catch {
      return '[object]';
    }
  }
  return String(v);
}

// Flatten an ObjectDiff into a list of leaf FieldDiff entries, with a
// dotted path label. Keeps the UI a simple table even when content has
// changed deeply.
interface FlatDiff {
  key: string; // dotted path
  leafLabel: string;
  from: unknown;
  to: unknown;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function flattenDiff(diff: ObjectDiff, prefix = ''): FlatDiff[] {
  const out: FlatDiff[] = [];
  for (const [k, v] of Object.entries(diff)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isFieldDiff(v)) {
      out.push({ key, leafLabel: fieldLabel(k), from: v.from, to: v.to });
    } else if (isPlainObject(v)) {
      out.push(...flattenDiff(v as ObjectDiff, key));
    } else {
      // Malformed diff (primitive at a non-leaf position). Render as a
      // best-effort leaf so the row still shows up instead of crashing —
      // and so we'd notice it in QA.
      out.push({ key, leafLabel: fieldLabel(k), from: null, to: v });
    }
  }
  return out;
}

type ActionFilter = 'all' | 'slide' | 'collection';

export function AuditList({ entries, slideTitles }: Props) {
  const [filter, setFilter] = useState<ActionFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    return entries.filter((e) => e.action.startsWith(`${filter}.`));
  }, [entries, filter]);

  const counts = useMemo(
    () => ({
      all: entries.length,
      slide: entries.filter((e) => e.action.startsWith('slide.')).length,
      collection: entries.filter((e) => e.action.startsWith('collection.')).length,
    }),
    [entries],
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-24 rounded-2xl border border-dashed border-navy/15 bg-cream/50">
        <div className="font-serif text-2xl text-navy mb-1">Quiet day</div>
        <p className="text-navy/55 text-sm">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 p-1 rounded-lg bg-navy/5 border border-navy/10 w-fit">
        {(['all', 'slide', 'collection'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-cream text-navy shadow-sm' : 'text-navy/60 hover:text-navy'
            }`}
          >
            {f === 'all' ? 'All' : f === 'slide' ? 'Slides' : 'Collections'}
            <span className="ml-1.5 font-mono text-[11px] text-navy/40">{counts[f]}</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((entry) => {
          const meta = ACTION_META[entry.action] ?? {
            label: entry.action,
            icon: Pencil,
            tint: 'bg-navy/5 text-navy/60',
          };
          const Icon = meta.icon;
          const open = expanded.has(entry.id);
          const md = (entry.metadata ?? {}) as {
            changes?: ObjectDiff;
            title?: string;
            templateType?: string;
            snapshot?: Record<string, unknown>;
            count?: number;
          };

          // Display target: known slide title (current) > metadata title (deleted) > raw id
          const slideMeta = entry.targetId ? slideTitles[entry.targetId] : null;
          const targetTitle = slideMeta?.title ?? md.title ?? null;
          const flat = md.changes ? flattenDiff(md.changes) : [];
          const hasDetail = flat.length > 0 || md.snapshot || md.count;

          return (
            <div key={entry.id} className="rounded-lg border border-navy/10 bg-cream overflow-hidden">
              <button
                type="button"
                onClick={() => hasDetail && toggle(entry.id)}
                className={`w-full px-4 py-3 flex items-start gap-3 text-left ${
                  hasDetail ? 'hover:bg-navy/[0.02]' : 'cursor-default'
                }`}
              >
                <div className={`shrink-0 mt-0.5 size-8 rounded-md grid place-items-center ${meta.tint}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-navy">{meta.label}</span>
                    {targetTitle && (
                      <>
                        <ArrowRight size={12} className="text-navy/30" />
                        {slideMeta && entry.targetId ? (
                          <Link
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            href={`/admin/slides/${entry.targetId}` as any}
                            className="text-sm text-navy font-medium hover:underline truncate max-w-[40ch]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {targetTitle}
                          </Link>
                        ) : (
                          <span className="text-sm text-navy/70 truncate max-w-[40ch]">{targetTitle}</span>
                        )}
                      </>
                    )}
                    <TimeAgo
                      date={entry.createdAt}
                      className="text-[11px] text-navy/45 ml-auto font-mono"
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-navy/55">
                    <span>{entry.userEmail ?? 'system'}</span>
                    {flat.length > 0 && (
                      <>
                        <span className="text-navy/30">·</span>
                        <span>
                          {flat.length} field{flat.length === 1 ? '' : 's'} changed
                        </span>
                      </>
                    )}
                    {entry.action === 'collection.activate' && md.count !== undefined && (
                      <>
                        <span className="text-navy/30">·</span>
                        <span>{md.count} slides activated</span>
                      </>
                    )}
                    {entry.action === 'collection.deactivate' && md.count !== undefined && (
                      <>
                        <span className="text-navy/30">·</span>
                        <span>{md.count} slides deactivated</span>
                      </>
                    )}
                  </div>
                </div>
                {hasDetail && (
                  <div className="shrink-0 text-navy/40 mt-1">
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                )}
              </button>

              {open && hasDetail && (
                <div className="px-4 pb-4 pt-1 border-t border-navy/5">
                  {flat.length > 0 && <DiffTable rows={flat} />}
                  {md.snapshot && (
                    <details className="mt-3 text-[11px]">
                      <summary className="cursor-pointer text-navy/50 font-medium uppercase tracking-widest">
                        Snapshot (for recovery)
                      </summary>
                      <pre className="mt-2 bg-navy/[0.03] text-navy/80 p-3 rounded-md overflow-x-auto font-mono whitespace-pre-wrap break-words">
                        {JSON.stringify(md.snapshot, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiffTable({ rows }: { rows: FlatDiff[] }) {
  return (
    <div className="mt-3 rounded-md border border-navy/10 overflow-hidden">
      <table className="w-full text-[12px]">
        <thead className="bg-navy/[0.03]">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-navy/55 uppercase tracking-widest text-[10px] w-1/4">
              Field
            </th>
            <th className="px-3 py-2 text-left font-medium text-navy/55 uppercase tracking-widest text-[10px]">
              Before
            </th>
            <th className="px-3 py-2 text-left font-medium text-navy/55 uppercase tracking-widest text-[10px]">
              After
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/5">
          {rows.map((r) => (
            <tr key={r.key} className="align-top">
              <td className="px-3 py-2 text-navy/70 font-medium">
                {r.leafLabel}
                {r.key.includes('.') && (
                  <div className="font-mono text-[10px] text-navy/35 mt-0.5">{r.key}</div>
                )}
              </td>
              <td className="px-3 py-2 text-rust">
                <span className="line-through opacity-70">{valueToString(r.from)}</span>
              </td>
              <td className="px-3 py-2 text-navy">{valueToString(r.to)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Re-export for use by callers that want to use the diff helpers directly.
export type { FieldDiff };
