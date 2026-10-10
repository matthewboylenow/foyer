'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Switch } from '@/components/ui/switch';
import { LivePreview } from './LivePreview';
import type { SourceItem, SourceDelivery, SlideContent } from '@/lib/db/schema';

function when(v: Date | string | null): string {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Items whose content WordPress owns. Foyer can hide one, change how often
 * or how long it plays, or pin it — never edit its words. That boundary is
 * what lets the sync re-deliver safely.
 */
export function SourceItemsList({ items: initial, deliveries }: { items: SourceItem[]; deliveries: SourceDelivery[] }) {
  const [items, setItems] = useState(initial);

  async function patch(id: string, body: Record<string, unknown>) {
    const prev = items;
    setItems((arr) => arr.map((i) => (i.id === id ? { ...i, ...body } : i)));
    try {
      const res = await fetch(`/api/sources/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Saved — live on the screens within a minute');
    } catch {
      setItems(prev);
      toast.error("Couldn't save");
    }
  }

  const now = Date.now();
  const playable = (i: SourceItem) => {
    if (i.status !== 'active' || i.hidden) return false;
    if (i.scheduleType === 'dated') {
      if (i.startAt && new Date(i.startAt).getTime() > now) return false;
      if (i.endAt && new Date(i.endAt).getTime() < now) return false;
    }
    return true;
  };

  return (
    <div className="space-y-8">
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy/20 bg-cream/50 p-8 text-center text-sm text-navy/60">
          Nothing from WordPress yet. Once the plugin is connected, approved announcements
          marked for signage appear here and go straight to the screens.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((i) => {
            const live = playable(i);
            return (
              <div key={i.id} className={`rounded-xl border bg-cream p-4 flex gap-4 ${live ? 'border-navy/15' : 'border-navy/10 opacity-70'}`}>
                <LivePreview templateType={i.templateType} content={i.content as SlideContent} orientation="portrait" width={110} imageUrl={i.imageUrl} />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`size-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-navy/25'}`} />
                    <p className="font-medium text-navy truncate">{i.title}</p>
                    <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-navy/8 text-navy/60">
                      WordPress · {i.kind}
                    </span>
                    {i.status === 'withdrawn' && (
                      <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Withdrawn
                      </span>
                    )}
                    {i.sourceUrl && (
                      <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-navy/50 hover:text-navy" title="Open in WordPress">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-navy/50">
                    Post #{i.sourceId} · rev {i.revision} · received {when(i.lastReceivedAt)}
                    {i.scheduleType === 'dated' ? ` · ${when(i.startAt)} → ${when(i.endAt)}` : ' · evergreen'}
                    {i.lastError ? ` · error: ${i.lastError}` : ''}
                  </p>
                  <div className="flex items-center gap-5 flex-wrap text-xs text-navy/70">
                    <label className="flex items-center gap-2">
                      <Switch checked={!i.hidden} onCheckedChange={(v) => patch(i.id, { hidden: !v })} />
                      {i.hidden ? 'Hidden on screens' : 'Showing'}
                    </label>
                    <label className="flex items-center gap-2">
                      How often
                      <select
                        value={String(i.weight)}
                        onChange={(e) => patch(i.id, { weight: Number(e.target.value) })}
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                      >
                        <option value="1">normal</option>
                        <option value="2">2×</option>
                        <option value="3">3×</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      Seconds
                      <input
                        type="number"
                        min={5}
                        max={120}
                        defaultValue={i.durationOverrideSec ?? ''}
                        placeholder="default"
                        onBlur={(e) => patch(i.id, { durationOverrideSec: e.target.value ? Number(e.target.value) : null })}
                        className="h-7 w-20 rounded-md border border-input bg-background px-2 text-xs"
                      />
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section>
        <h2 className="font-serif text-lg font-semibold text-navy mb-2">Recent deliveries</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-navy/50">No deliveries received yet.</p>
        ) : (
          <ul className="text-xs text-navy/70 space-y-1">
            {deliveries.map((d) => (
              <li key={d.id} className="flex gap-2">
                <span className={d.ok ? 'text-emerald-600' : 'text-rust'}>{d.ok ? '✓' : '✗'}</span>
                <span>
                  {when(d.receivedAt)} · {d.outcome} · {d.itemCount} item{d.itemCount === 1 ? '' : 's'}
                  {d.summary && Object.keys(d.summary).length > 0
                    ? ` (${Object.entries(d.summary).map(([k, v]) => `${v} ${k}`).join(', ')})`
                    : ''}
                  {d.error ? ` · ${d.error}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
