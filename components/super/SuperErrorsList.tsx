'use client';

import { useMemo, useState } from 'react';
import { TimeAgo } from '@/components/admin/TimeAgo';
import { ChevronDown, ChevronRight, AlertTriangle, Monitor, LayoutGrid, Server, Building2 } from 'lucide-react';

export interface SuperErrorRow {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  context: unknown;
  displayId: string | null;
  slideId: string | null;
  createdAt: string;
  tenantId: string | null;
  tenantName: string | null;
}

const SOURCE_META: Record<string, { icon: typeof Server; label: string; tint: string }> = {
  player: { icon: Monitor, label: 'Player', tint: 'bg-rust/20 text-rust' },
  admin: { icon: LayoutGrid, label: 'Admin', tint: 'bg-cream/15 text-cream' },
  api: { icon: Server, label: 'API', tint: 'bg-gold/20 text-gold' },
  unknown: { icon: AlertTriangle, label: 'Unknown', tint: 'bg-cream/10 text-cream/60' },
};

type SourceFilter = 'all' | 'player' | 'admin' | 'api';

interface Props {
  errors: SuperErrorRow[];
}

export function SuperErrorsList({ errors }: Props) {
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sourceCounts = useMemo(() => {
    const c = { all: errors.length, player: 0, admin: 0, api: 0 };
    for (const e of errors) {
      if (e.source === 'player') c.player++;
      else if (e.source === 'admin') c.admin++;
      else if (e.source === 'api') c.api++;
    }
    return c;
  }, [errors]);

  const tenantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of errors) {
      const key = e.tenantId ?? '__system__';
      const label = e.tenantName ?? '(system)';
      if (!seen.has(key)) seen.set(key, label);
    }
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [errors]);

  const filtered = errors.filter((e) => {
    if (filter !== 'all' && e.source !== filter) return false;
    if (tenantFilter !== 'all') {
      const key = e.tenantId ?? '__system__';
      if (key !== tenantFilter) return false;
    }
    return true;
  });

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
      <div className="text-center py-20 rounded-2xl border border-dashed border-cream/15 bg-black/20">
        <div className="font-serif text-2xl text-cream/85 mb-1">All quiet</div>
        <p className="text-cream/55 text-sm">No errors recorded on any tenant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 p-1 rounded-lg bg-cream/5 border border-cream/10">
          {(['all', 'player', 'admin', 'api'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                filter === f ? 'bg-cream text-navy shadow-sm' : 'text-cream/65 hover:text-cream'
              }`}
            >
              {f}
              <span className="ml-1.5 font-mono text-[11px] text-cream/40">{sourceCounts[f]}</span>
            </button>
          ))}
        </div>

        {tenantOptions.length > 1 && (
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="bg-cream/5 border border-cream/10 rounded-lg px-3 py-1.5 text-sm text-cream"
          >
            <option value="all">All parishes</option>
            {tenantOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        {filtered.map((err) => {
          const meta = SOURCE_META[err.source] ?? SOURCE_META.unknown;
          const Icon = meta.icon;
          const isOpen = expanded.has(err.id);
          const contextStr =
            err.context && Object.keys(err.context as object).length > 0
              ? JSON.stringify(err.context, null, 2)
              : null;

          return (
            <div key={err.id} className="rounded-lg border border-cream/10 bg-black/30 overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(err.id)}
                className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-cream/[0.03]"
              >
                <div className={`shrink-0 mt-0.5 size-8 rounded-md grid place-items-center ${meta.tint}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-widest font-medium text-cream/50">
                      {meta.label}
                    </span>
                    <span className="text-[11px] text-cream/65 inline-flex items-center gap-1">
                      <Building2 size={11} /> {err.tenantName ?? '(system)'}
                    </span>
                    {err.displayId && (
                      <span className="text-[11px] text-cream/55 inline-flex items-center gap-1">
                        <Monitor size={11} /> {err.displayId.slice(0, 8)}
                      </span>
                    )}
                    {err.slideId && (
                      <span className="text-[11px] text-cream/55 inline-flex items-center gap-1">
                        <LayoutGrid size={11} /> {err.slideId.slice(0, 8)}
                      </span>
                    )}
                    <TimeAgo date={err.createdAt} className="text-[11px] text-cream/45 ml-auto font-mono" />
                  </div>
                  <p className="mt-1 text-sm text-cream font-medium truncate" title={err.message}>
                    {err.message}
                  </p>
                </div>
                <div className="shrink-0 text-cream/40 mt-1">
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-cream/5 space-y-3">
                  {err.stack && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-cream/50 mb-1">Stack</div>
                      <pre className="text-[11px] bg-black/40 text-cream/80 p-3 rounded-md overflow-x-auto whitespace-pre-wrap break-words font-mono">
                        {err.stack}
                      </pre>
                    </div>
                  )}
                  {contextStr && (
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-cream/50 mb-1">Context</div>
                      <pre className="text-[11px] bg-black/40 text-cream/80 p-3 rounded-md overflow-x-auto font-mono">
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
