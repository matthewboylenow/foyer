'use client';

import { useState, useEffect, useMemo } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { templates } from '@/components/templates';
import type { Display, SlideContent, SlideWithContent } from '@/lib/db/schema';

const TEMPLATE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(templates).map(([k, v]) => [k, v.label]),
);

// Now-Playing preview geometry — same trick as SlideCard but smaller.
const NP_W = 160;
const NP_H = NP_W * (1920 / 1080); // ≈ 284px

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success('URL copied'),
    () => toast.error('Could not copy'),
  );
}

const BASE_URL =
  typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ?? '';

interface DisplayStatus {
  id: string;
  name: string;
  location: string | null;
  active: boolean;
  status: 'online' | 'stale' | 'offline';
  lastHeartbeatAt: string | null;
  currentSlideStartedAt: string | null;
  currentSlide:
    | (SlideWithContent & { resolvedMedia?: Record<string, string> })
    | null;
}

interface DisplayManagerProps {
  displays: Display[];
}

export function DisplayManager({ displays: initial }: DisplayManagerProps) {
  const [displays, setDisplays] = useState(initial);
  const [status, setStatus] = useState<Record<string, DisplayStatus>>({});
  const [now, setNow] = useState(() => Date.now());
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Poll /api/displays/status every 10 seconds. Also tick a local clock once
  // a second so the "12s on screen" counter updates between polls.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/displays/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as DisplayStatus[];
        if (cancelled) return;
        setStatus(Object.fromEntries(data.map((d) => [d.id, d])));
      } catch {
        /* network blip — retry next tick */
      }
    }
    load();
    const poll = setInterval(load, 10_000);
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      cancelled = true;
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  async function addDisplay() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/displays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, location: newLocation }),
      });
      if (!res.ok) throw new Error('Failed');
      const created: Display = await res.json();
      setDisplays((prev) => [...prev, created]);
      setNewName('');
      setNewLocation('');
      setShowForm(false);
      toast.success('Display added');
    } catch {
      toast.error("Couldn't add display");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    setDisplays((prev) => prev.map((d) => (d.id === id ? { ...d, active: !current } : d)));
    try {
      await fetch(`/api/displays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !current }),
      });
    } catch {
      setDisplays((prev) => prev.map((d) => (d.id === id ? { ...d, active: current } : d)));
      toast.error("Couldn't update display");
    }
  }

  async function deleteDisplay(id: string) {
    if (!confirm('Delete this display? OptiSigns will need to be reconfigured.')) return;
    try {
      await fetch(`/api/displays/${id}`, { method: 'DELETE' });
      setDisplays((prev) => prev.filter((d) => d.id !== id));
      toast.success('Display deleted');
    } catch {
      toast.error("Couldn't delete display");
    }
  }

  return (
    <div className="space-y-4">
      {displays.map((d) => (
        <DisplayRow
          key={d.id}
          display={d}
          status={status[d.id]}
          now={now}
          baseUrl={BASE_URL}
          onToggleActive={toggleActive}
          onDelete={deleteDisplay}
        />
      ))}

      {showForm ? (
        <div className="border border-navy/15 rounded-xl p-4 bg-cream space-y-3">
          <h3 className="font-medium text-sm">Add display</h3>
          <Input
            placeholder="Name (e.g. Lobby)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDisplay()}
          />
          <Input
            placeholder="Location (optional)"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={addDisplay} disabled={adding} className="bg-rust text-cream hover:bg-rust-700">
              {adding ? 'Adding…' : 'Add'}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowForm(true)} className="gap-2">
          <Plus size={16} />
          Add display
        </Button>
      )}
    </div>
  );
}

function DisplayRow({
  display: d,
  status,
  now,
  baseUrl,
  onToggleActive,
  onDelete,
}: {
  display: Display;
  status: DisplayStatus | undefined;
  now: number;
  baseUrl: string;
  onToggleActive: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const url = `${baseUrl}/display/${d.id}`;
  const currentSlide = status?.currentSlide ?? null;
  const templateConfig = currentSlide ? templates[currentSlide.templateType] : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TemplateComponent = templateConfig?.component as React.ComponentType<any> | undefined;

  const onScreenSec = useMemo(() => {
    if (!status?.currentSlideStartedAt) return null;
    return Math.max(0, Math.floor((now - new Date(status.currentSlideStartedAt).getTime()) / 1000));
  }, [status?.currentSlideStartedAt, now]);

  const lastSeenLabel = useMemo(() => {
    if (!status?.lastHeartbeatAt) return 'Never';
    const ageSec = Math.floor((now - new Date(status.lastHeartbeatAt).getTime()) / 1000);
    if (ageSec < 10) return 'Just now';
    if (ageSec < 60) return `${ageSec}s ago`;
    if (ageSec < 3600) return `${Math.floor(ageSec / 60)}m ago`;
    if (ageSec < 86400) return `${Math.floor(ageSec / 3600)}h ago`;
    return `${Math.floor(ageSec / 86400)}d ago`;
  }, [status?.lastHeartbeatAt, now]);

  const statusLevel = status?.status ?? 'offline';
  const dotColor =
    statusLevel === 'online'
      ? 'bg-emerald-500'
      : statusLevel === 'stale'
        ? 'bg-amber-500'
        : 'bg-navy/25';
  const dotPulse = statusLevel === 'online' ? 'animate-pulse' : '';

  return (
    <div className="border border-navy/15 rounded-xl p-5 bg-cream">
      <div className="flex items-start gap-5">
        {/* Now-Playing preview (left). Falls back to placeholder when offline / no slide yet. */}
        <div
          className="shrink-0 rounded-lg overflow-hidden bg-ink relative"
          style={{ width: NP_W, height: NP_H }}
        >
          {TemplateComponent && currentSlide ? (
            <div
              className="absolute top-0 left-0 origin-top-left pointer-events-none slide-thumb"
              data-exiting="true"
              style={{
                width: 1080,
                height: 1920,
                transform: `scale(${NP_W / 1080})`,
              }}
            >
              <TemplateComponent
                content={currentSlide.content as SlideContent}
                logoUrl={currentSlide.resolvedMedia?.logoUrl}
                bgImageUrl={currentSlide.resolvedMedia?.bgImageUrl}
                bgVideoUrl={currentSlide.resolvedMedia?.bgVideoUrl}
                phoneMockupUrl={currentSlide.resolvedMedia?.phoneMockupUrl}
              />
            </div>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-cream/30 text-xs uppercase tracking-widest">
              {statusLevel === 'offline' ? 'Offline' : 'Waiting…'}
            </div>
          )}
        </div>

        {/* Right column — identity, status, current slide, URL */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${dotColor} ${dotPulse}`} aria-hidden />
                <p className="font-serif text-xl font-semibold text-navy leading-none">
                  {d.name}
                </p>
              </div>
              {d.location && (
                <p className="text-sm text-navy/55 mt-1">{d.location}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={d.active} onCheckedChange={() => onToggleActive(d.id, d.active)} />
              <button
                onClick={() => onDelete(d.id)}
                className="p-1.5 text-navy/40 hover:text-rust rounded-md hover:bg-navy/5"
                aria-label="Delete display"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Now Playing meta */}
          <div className="mt-4 space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-navy/45 font-medium">
              Now Playing
            </div>
            {currentSlide ? (
              <>
                <p className="font-medium text-navy truncate" title={currentSlide.title}>
                  {currentSlide.title || 'Untitled'}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="font-mono uppercase tracking-widest text-navy/50">
                    {TEMPLATE_LABELS[currentSlide.templateType] ?? currentSlide.templateType}
                  </span>
                  {onScreenSec !== null && (
                    <span className="text-navy/55 font-mono">
                      {onScreenSec < 60
                        ? `${onScreenSec}s on screen`
                        : `${Math.floor(onScreenSec / 60)}m ${onScreenSec % 60}s`}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-navy/45 italic">
                {statusLevel === 'offline'
                  ? 'No recent heartbeat — TV may be powered off or disconnected.'
                  : 'Waiting for first heartbeat…'}
              </p>
            )}
            <div className="text-[11px] text-navy/45">
              Last heartbeat: <span className="font-mono">{lastSeenLabel}</span>
            </div>
          </div>

          {/* Kiosk URL */}
          <div className="mt-4 flex items-center gap-2">
            <code className="text-xs bg-navy/5 text-navy/70 px-2 py-1 rounded truncate flex-1">
              {url}
            </code>
            <button
              onClick={() => copyToClipboard(url)}
              className="p-1.5 hover:bg-navy/5 rounded-md text-navy/60 hover:text-navy"
              title="Copy URL"
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
