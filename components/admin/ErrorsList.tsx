'use client';

import { useState, useMemo } from 'react';
import { TimeAgo } from './TimeAgo';
import { ChevronDown, ChevronRight, AlertTriangle, Monitor, LayoutGrid, Server } from 'lucide-react';

interface ErrorRow {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  context: unknown;
  displayId: string | null;
  slideId: string | null;
  createdAt: string;
}

interface Props {
  errors: ErrorRow[];
  displayNames: Record<string, string>;
  slideTitles: Record<string, { title: string; templateType: string }>;
}

const SOURCE_META: Record<string, { icon: typeof Server; label: string; tint: string }> = {
  player: { icon: Monitor, label: 'Player', tint: 'bg-rust/10 text-rust' },
  admin: { icon: LayoutGrid, label: 'Admin', tint: 'bg-navy/10 text-navy' },
  api: { icon: Server, label: 'API', tint: 'bg-gold/15 text-gold' },
  unknown: { icon: AlertTriangle, label: 'Unknown', tint: 'bg-navy/5 text-navy/60' },
};

type SourceFilter = 'all' | 'player' | 'admin' | 'api';

export function ErrorsList({ errors, displayNames, slideTitles }: Props) {
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c = { all: errors.length, player: 0, admin: 0, api: 0 };
    for (const e of errors) {
      if (e.source === 'player') c.player++;
      else if (e.source === 'admin') c.admin++;
      else if (e.source === 'api') c.api++;
    }
    return c;
  }, [errors]);

  const filtered = filter === 'all' ? errors : errors.filter((e) => e.source === filter);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (errors.length === 0) {
    return (
      <div className="text-center py-24 rounded-2xl border border-dashed border-navy/15 bg-cream/50">
        <div className="font-serif text-2xl text-navy mb-1">All quiet</div>
        <p className="text-navy/55 text-sm">No errors recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 p-1 rounded-lg bg-navy/5 border border-navy/10 w-fit">
        {(['all', 'player', 'admin', 'api'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-cream text-navy shadow-sm' : 'text-navy/60 hover:text-navy'
            }`}
          >
            {f}
            <span className="ml-1.5 font-mono text-[11px] text-navy/40">
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((err) => {
          const meta = SOURCE_META[err.source] ?? SOURCE_META.unknown;
          const Icon = meta.icon;
          const isOpen = expanded.has(err.id);
          const displayLabel = err.displayId ? displayNames[err.displayId] ?? err.displayId.slice(0, 8) : null;
          const slideLabel = err.slideId ? slideTitles[err.slideId]?.title ?? err.slideId.slice(0, 8) : null;
          const contextStr = err.context && Object.keys(err.context as object).length > 0
            ? JSON.stringify(err.context, null, 2)
            : null;

          return (
            <div key={err.id} className="rounded-lg border border-navy/10 bg-cream overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(err.id)}
                className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-navy/[0.02]"
              >
                <div className={`shrink-0 mt-0.5 size-8 rounded-md grid place-items-center ${meta.tint}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-widest font-medium text-navy/45">
                      {meta.label}
                    </span>
                    {displayLabel && (
                      <span className="text-[11px] text-navy/55 inline-flex items-center gap-1">
                        <Monitor size={11} /> {displayLabel}
                      </span>
                    )}
                    {slideLabel && (
                      <span className="text-[11px] text-navy/55 inline-flex items-center gap-1">
                        <LayoutGrid size={11} /> {slideLabel}
                      </span>
                    )}
                    <TimeAgo
                      date={err.createdAt}
                      className="text-[11px] text-navy/45 ml-auto font-mono"
                    />
                  </div>
                  <p className="mt-1 text-sm text-navy font-medium truncate" title={err.message}>
                    {err.message}
                  </p>
                </div>
                <div className="shrink-0 text-navy/40 mt-1">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-navy/5 space-y-3">
                  {err.stack && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-navy/45 mb-1">
                        Stack
                      </div>
                      <pre className="text-[11px] bg-navy/[0.03] text-navy/80 p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words font-mono">
                        {err.stack}
                      </pre>
                    </div>
                  )}
                  {contextStr && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-navy/45 mb-1">
                        Context
                      </div>
                      <pre className="text-[11px] bg-navy/[0.03] text-navy/80 p-3 rounded-md overflow-x-auto font-mono">
                        {contextStr}
                      </pre>
                    </div>
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
