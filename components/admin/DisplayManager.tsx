'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Copy,
  Plus,
  Trash2,
  RectangleVertical,
  RectangleHorizontal,
  Camera,
  RefreshCw,
  Power,
  MoreHorizontal,
  Cpu,
  Thermometer,
  Wifi,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { templates } from '@/components/templates';
import { UptimeStrip } from './UptimeStrip';
import { PiSetupDialog } from './PiSetupDialog';
import { decodeThrottled, formatDuration } from '@/lib/monitoring';
import type { AgentCommand, Display, DisplayEvent, SlideContent, SlideOrientation } from '@/lib/db/schema';
import type { DisplayStatusPayload } from '@/app/api/displays/status/route';

const TEMPLATE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(templates).map(([k, v]) => [k, v.label]),
);

// Preview geometry. Portrait = 1080×1920; landscape = 1920×1080. The thumb
// is rendered at the orientation of the display so the admin sees the same
// aspect the TV does.
const NP_W_PORTRAIT = 160;
const NP_H_PORTRAIT = NP_W_PORTRAIT * (1920 / 1080); // ≈ 284px
const NP_H_LANDSCAPE = 160;
const NP_W_LANDSCAPE = NP_H_LANDSCAPE * (1920 / 1080); // ≈ 284px

const STATUS_POLL_MS = 15_000;

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

function ago(iso: string | null, now: number): string {
  if (!iso) return 'never';
  const sec = Math.floor((now - new Date(iso).getTime()) / 1000);
  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function pct(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(v === 100 ? 0 : 1)}%`;
}

interface DisplayManagerProps {
  displays: Display[];
}

export function DisplayManager({ displays: initial }: DisplayManagerProps) {
  const [displays, setDisplays] = useState(initial);
  const [status, setStatus] = useState<Record<string, DisplayStatusPayload>>({});
  const [now, setNow] = useState(() => Date.now());
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newOrientation, setNewOrientation] = useState<SlideOrientation>('portrait');
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Poll /api/displays/status while the page is open. Also tick a local
  // clock once a second so "12s on screen" and "2m ago" stay live.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/displays/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as DisplayStatusPayload[];
        if (cancelled) return;
        setStatus(Object.fromEntries(data.map((d) => [d.id, d])));
      } catch {
        /* network blip — retry next tick */
      }
    }
    load();
    const poll = setInterval(load, STATUS_POLL_MS);
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
        body: JSON.stringify({
          name: newName,
          location: newLocation,
          orientation: newOrientation,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const created: Display = await res.json();
      setDisplays((prev) => [...prev, created]);
      setNewName('');
      setNewLocation('');
      setNewOrientation('portrait');
      setShowForm(false);
      toast.success('Display added');
    } catch {
      toast.error("Couldn't add display");
    } finally {
      setAdding(false);
    }
  }

  async function changeOrientation(id: string, next: SlideOrientation) {
    const prev = displays.find((d) => d.id === id)?.orientation;
    setDisplays((arr) => arr.map((d) => (d.id === id ? { ...d, orientation: next } : d)));
    try {
      const res = await fetch(`/api/displays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orientation: next }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Switched to ${next === 'portrait' ? 'vertical' : 'horizontal'}`);
    } catch {
      setDisplays((arr) =>
        arr.map((d) => (d.id === id && prev ? { ...d, orientation: prev } : d)),
      );
      toast.error("Couldn't change orientation");
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
    if (!confirm('Delete this display? Anything pointed at its URL will show a blank screen.')) return;
    try {
      await fetch(`/api/displays/${id}`, { method: 'DELETE' });
      setDisplays((prev) => prev.filter((d) => d.id !== id));
      toast.success('Display deleted');
    } catch {
      toast.error("Couldn't delete display");
    }
  }

  async function setHardware(id: string, hardware: 'optisigns' | 'browser') {
    try {
      const res = await fetch(`/api/displays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hardware }),
      });
      if (!res.ok) throw new Error('Failed');
      setStatus((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], hardware } } : prev));
      toast.success(hardware === 'optisigns' ? 'Labeled as OptiSigns' : 'Labeled as browser');
    } catch {
      toast.error("Couldn't update display");
    }
  }

  async function sendCommand(id: string, command: AgentCommand) {
    const labels: Record<AgentCommand, string> = {
      reboot: 'Reboot queued — the Pi picks it up within a minute',
      reload: 'Reload queued — the player picks it up within a minute',
      screenshot: 'Screenshot queued — check back in a minute',
      update: 'Agent update queued',
    };
    if (command === 'reboot' && !confirm('Reboot this Raspberry Pi? The screen goes dark for about a minute.')) {
      return;
    }
    try {
      const res = await fetch(`/api/displays/${id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (!res.ok) throw new Error('Failed');
      setStatus((prev) =>
        prev[id]
          ? { ...prev, [id]: { ...prev[id], pendingCommand: command, pendingCommandAt: new Date().toISOString() } }
          : prev,
      );
      toast.success(labels[command]);
    } catch {
      toast.error("Couldn't send that command");
    }
  }

  return (
    <div className="space-y-4">
      {displays.map((d) => (
        <DisplayCard
          key={d.id}
          display={d}
          status={status[d.id]}
          now={now}
          baseUrl={BASE_URL}
          onToggleActive={toggleActive}
          onDelete={deleteDisplay}
          onChangeOrientation={changeOrientation}
          onCommand={sendCommand}
          onSetHardware={setHardware}
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
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-widest text-navy/50 font-medium">
              Orientation
            </div>
            <OrientationToggle value={newOrientation} onChange={setNewOrientation} />
            <p className="text-xs text-navy/55">
              Match how the TV is physically mounted. You can change this later.
            </p>
          </div>
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

function OrientationToggle({
  value,
  onChange,
  size = 'md',
}: {
  value: SlideOrientation;
  onChange: (next: SlideOrientation) => void;
  size?: 'sm' | 'md';
}) {
  const padding = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm';
  const iconSize = size === 'sm' ? 13 : 14;
  return (
    <div
      className="inline-flex rounded-md border border-navy/20 bg-cream overflow-hidden"
      role="radiogroup"
      aria-label="Orientation"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'portrait'}
        onClick={() => onChange('portrait')}
        className={`flex items-center gap-1.5 font-medium transition-colors ${padding} ${
          value === 'portrait' ? 'bg-navy text-cream' : 'text-navy/65 hover:bg-navy/5'
        }`}
      >
        <RectangleVertical size={iconSize} />
        Vertical
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'landscape'}
        onClick={() => onChange('landscape')}
        className={`flex items-center gap-1.5 font-medium transition-colors ${padding} ${
          value === 'landscape' ? 'bg-navy text-cream' : 'text-navy/65 hover:bg-navy/5'
        }`}
      >
        <RectangleHorizontal size={iconSize} />
        Horizontal
      </button>
    </div>
  );
}

// ─── One display ─────────────────────────────────────────────────────────────

function DisplayCard({
  display: d,
  status,
  now,
  baseUrl,
  onToggleActive,
  onDelete,
  onChangeOrientation,
  onCommand,
  onSetHardware,
}: {
  display: Display;
  status: DisplayStatusPayload | undefined;
  now: number;
  baseUrl: string;
  onToggleActive: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  onChangeOrientation: (id: string, next: SlideOrientation) => void;
  onCommand: (id: string, command: AgentCommand) => void;
  onSetHardware: (id: string, hardware: 'optisigns' | 'browser') => void;
}) {
  const [piOpen, setPiOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const [view, setView] = useState<'auto' | 'screenshot' | 'rendered'>('auto');

  const orientation = (d.orientation === 'landscape' ? 'landscape' : 'portrait') as SlideOrientation;
  const npW = orientation === 'landscape' ? NP_W_LANDSCAPE : NP_W_PORTRAIT;
  const npH = orientation === 'landscape' ? NP_H_LANDSCAPE : NP_H_PORTRAIT;
  const previewW = orientation === 'landscape' ? 1920 : 1080;
  const previewH = orientation === 'landscape' ? 1080 : 1920;
  const url = `${baseUrl}/display/${d.id}`;
  const currentSlide = status?.currentSlide ?? null;
  const templateConfig = currentSlide ? templates[currentSlide.templateType] : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TemplateComponent = templateConfig?.component as React.ComponentType<any> | undefined;

  const statusLevel = status?.status ?? 'offline';
  const agent = status?.agent;
  const agentOnline = agent?.status === 'online';
  const isPi = status?.hardware === 'pi';
  const info = agent?.info ?? null;
  const throttleFlags = decodeThrottled(info?.throttled);
  const chromiumDown = agentOnline && info?.chromiumRunning === false;

  const onScreenSec = useMemo(() => {
    if (!status?.currentSlideStartedAt) return null;
    return Math.max(0, Math.floor((now - new Date(status.currentSlideStartedAt).getTime()) / 1000));
  }, [status?.currentSlideStartedAt, now]);

  const showScreenshot =
    !!status?.screenshotUrl && (view === 'screenshot' || (view === 'auto' && !!status.screenshotAt));

  const dot =
    statusLevel === 'online'
      ? { color: 'bg-emerald-500', pulse: 'animate-pulse', label: 'Online' }
      : statusLevel === 'stale'
        ? { color: 'bg-amber-500', pulse: '', label: 'Not heard from in a few minutes' }
        : { color: 'bg-rust', pulse: '', label: 'Offline' };

  const offlineFor =
    statusLevel === 'offline' && status?.offlineSince
      ? formatDuration((now - new Date(status.offlineSince).getTime()) / 1000)
      : null;

  const hardwareLabel = isPi ? 'Raspberry Pi' : status?.hardware === 'optisigns' ? 'OptiSigns' : 'Browser';

  return (
    <div
      className={`border rounded-xl p-5 bg-cream ${
        statusLevel === 'offline' && d.active ? 'border-rust/40' : 'border-navy/15'
      }`}
    >
      <div className="flex items-start gap-5 flex-col sm:flex-row">
        {/* Screen preview (left): real screenshot when we have one, else the
            rendered now-playing slide. */}
        <div className="shrink-0 space-y-1.5">
          <div
            className="rounded-lg overflow-hidden bg-ink relative"
            style={{ width: npW, height: npH }}
          >
            {showScreenshot && status?.screenshotUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${status.screenshotUrl}?t=${encodeURIComponent(status.screenshotAt ?? '')}`}
                alt={`Screenshot of ${d.name}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : TemplateComponent && currentSlide ? (
              <div
                className="absolute top-0 left-0 origin-top-left pointer-events-none slide-thumb"
                data-exiting="true"
                style={{
                  width: previewW,
                  height: previewH,
                  transform: `scale(${npW / previewW})`,
                }}
              >
                <TemplateComponent
                  content={currentSlide.content as SlideContent}
                  orientation={orientation}
                  logoUrl={currentSlide.resolvedMedia?.logoUrl}
                  bgImageUrl={currentSlide.resolvedMedia?.bgImageUrl}
                  bgVideoUrl={currentSlide.resolvedMedia?.bgVideoUrl}
                  phoneMockupUrl={currentSlide.resolvedMedia?.phoneMockupUrl}
                  imageUrl={currentSlide.resolvedMedia?.imageUrl}
                />
              </div>
            ) : (
              <div className="absolute inset-0 grid place-items-center text-cream/30 text-xs uppercase tracking-widest text-center px-3">
                {statusLevel === 'offline' ? 'Offline' : 'Waiting…'}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-navy/45 uppercase tracking-widest" style={{ width: npW }}>
            {status?.screenshotUrl ? (
              <button
                type="button"
                onClick={() => setView(showScreenshot ? 'rendered' : 'screenshot')}
                className="hover:text-navy underline-offset-2 hover:underline"
              >
                {showScreenshot ? `Photo · ${ago(status.screenshotAt, now)}` : 'Rendered · show photo'}
              </button>
            ) : (
              <span>Rendered</span>
            )}
            {isPi && (
              <button
                type="button"
                onClick={() => onCommand(d.id, 'screenshot')}
                disabled={!agentOnline}
                className="p-1 rounded hover:bg-navy/5 text-navy/60 hover:text-navy disabled:opacity-30"
                title={agentOnline ? 'Take a screenshot' : 'Agent offline'}
              >
                <Camera size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="flex-1 min-w-0 w-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`size-2.5 rounded-full ${dot.color} ${dot.pulse}`} title={dot.label} aria-hidden />
                <p className="font-serif text-xl font-semibold text-navy leading-none">{d.name}</p>
                <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-navy/8 text-navy/60">
                  {hardwareLabel}
                </span>
                {!d.active && (
                  <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                    Paused
                  </span>
                )}
              </div>
              <p className="text-sm text-navy/55 mt-1">
                {d.location ? `${d.location} · ` : ''}
                {statusLevel === 'online'
                  ? 'Online'
                  : statusLevel === 'stale'
                    ? `Last seen ${ago(status?.lastHeartbeatAt ?? null, now)}`
                    : offlineFor
                      ? `Offline for ${offlineFor}`
                      : status?.lastHeartbeatAt
                        ? `Offline · last seen ${ago(status.lastHeartbeatAt, now)}`
                        : 'Never checked in'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={d.active} onCheckedChange={() => onToggleActive(d.id, d.active)} />
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="p-1.5 text-navy/50 hover:text-navy rounded-md hover:bg-navy/5"
                  aria-label="Display actions"
                >
                  <MoreHorizontal size={16} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onCommand(d.id, 'reload')}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Reload player
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCommand(d.id, 'screenshot')} disabled={!agentOnline}>
                    <Camera className="w-4 h-4 mr-2" /> Take screenshot
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCommand(d.id, 'reboot')} disabled={!agentOnline}>
                    <Power className="w-4 h-4 mr-2" /> Reboot Pi
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCommand(d.id, 'update')} disabled={!agentOnline}>
                    <Cpu className="w-4 h-4 mr-2" /> Update Pi agent
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setPiOpen(true)}>
                    <Cpu className="w-4 h-4 mr-2" /> {isPi ? 'Pi setup command' : 'Set up a Raspberry Pi'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => copyToClipboard(url)}>
                    <Copy className="w-4 h-4 mr-2" /> Copy display URL
                  </DropdownMenuItem>
                  {!isPi && (
                    <DropdownMenuItem
                      onClick={() =>
                        onSetHardware(d.id, status?.hardware === 'optisigns' ? 'browser' : 'optisigns')
                      }
                    >
                      <MoreHorizontal className="w-4 h-4 mr-2" />
                      {status?.hardware === 'optisigns' ? 'Label as browser' : 'Label as OptiSigns'}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onDelete(d.id)} className="text-rust">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete display
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Warnings */}
          {(status?.pendingCommand || chromiumDown || throttleFlags.length > 0 || (isPi && agent?.status === 'offline')) && (
            <div className="mt-3 space-y-1.5">
              {status?.pendingCommand && (
                <Notice tone="info">
                  <Clock size={13} />
                  {status.pendingCommand === 'reboot'
                    ? 'Reboot queued'
                    : status.pendingCommand === 'reload'
                      ? 'Reload queued'
                      : status.pendingCommand === 'screenshot'
                        ? 'Screenshot queued'
                        : 'Agent update queued'}
                  {' · '}sent {ago(status.pendingCommandAt, now)}, the screen picks it up within a minute
                </Notice>
              )}
              {chromiumDown && (
                <Notice tone="warn">
                  <AlertTriangle size={13} />
                  The Pi is up but Chromium is not running. Try “Reload player”, then “Reboot Pi”.
                </Notice>
              )}
              {isPi && agent?.status === 'offline' && (
                <Notice tone="warn">
                  <AlertTriangle size={13} />
                  The Pi agent has not checked in since {ago(agent.lastSeenAt, now)}. The Pi may be off or off the network.
                </Notice>
              )}
              {throttleFlags.length > 0 && (
                <Notice tone="warn">
                  <AlertTriangle size={13} />
                  {throttleFlags.join(', ')}. Usually the power supply — use the official Pi PSU.
                </Notice>
              )}
            </div>
          )}

          {/* Facts grid */}
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <Fact label="Now playing">
              {currentSlide ? (
                <>
                  <span className="font-medium text-navy truncate block" title={currentSlide.title}>
                    {currentSlide.title || 'Untitled'}
                  </span>
                  <span className="text-xs text-navy/50">
                    {TEMPLATE_LABELS[currentSlide.templateType] ?? currentSlide.templateType}
                    {onScreenSec !== null && ` · ${formatDuration(onScreenSec)}`}
                  </span>
                </>
              ) : (
                <span className="text-navy/45 italic">—</span>
              )}
            </Fact>
            <Fact label="Player">
              <span className="text-navy">{dot.label}</span>
              <span className="text-xs text-navy/50 block">heartbeat {ago(status?.lastHeartbeatAt ?? null, now)}</span>
            </Fact>
            <Fact label="Device">
              {isPi && info ? (
                <>
                  <span className="text-navy flex items-center gap-1.5">
                    <span className={`size-1.5 rounded-full ${agentOnline ? 'bg-emerald-500' : 'bg-rust'}`} />
                    {info.model?.replace('Raspberry Pi', 'Pi').replace(' Rev', ' rev') ?? 'Raspberry Pi'}
                  </span>
                  <span className="text-xs text-navy/50 flex items-center gap-2 flex-wrap">
                    {info.cpuTempC !== undefined && (
                      <span className={`inline-flex items-center gap-0.5 ${info.cpuTempC >= 75 ? 'text-rust' : ''}`}>
                        <Thermometer size={11} />
                        {info.cpuTempC.toFixed(0)}°C
                      </span>
                    )}
                    {info.uptimeSec !== undefined && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock size={11} />
                        up {formatDuration(info.uptimeSec)}
                      </span>
                    )}
                    {info.ip && (
                      <span className="inline-flex items-center gap-0.5 font-mono">
                        <Wifi size={11} />
                        {info.ip}
                      </span>
                    )}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-navy/70">{hardwareLabel}</span>
                  <button
                    type="button"
                    onClick={() => setPiOpen(true)}
                    className="text-xs text-rust hover:underline block"
                  >
                    Set up a Raspberry Pi
                  </button>
                </>
              )}
            </Fact>
            <Fact label="Uptime">
              <span className="text-navy font-mono">
                {pct(status?.uptime.day ?? null)}
                <span className="text-navy/40 text-xs"> 24h</span>
              </span>
              <span className="text-xs text-navy/50 font-mono block">
                {pct(status?.uptime.week ?? null)} 7d · {pct(status?.uptime.month ?? null)} 30d
              </span>
            </Fact>
          </div>

          {/* History strip */}
          <div className="mt-4">
            {status ? (
              <UptimeStrip buckets={status.strip} />
            ) : (
              <div className="h-6 rounded bg-navy/5 animate-pulse" />
            )}
          </div>

          {/* Footer: orientation, URL, events toggle */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <OrientationToggle
              value={orientation}
              onChange={(next) => onChangeOrientation(d.id, next)}
              size="sm"
            />
            <code className="text-xs bg-navy/5 text-navy/70 px-2 py-1 rounded truncate flex-1 min-w-[160px]">
              {url}
            </code>
            <button
              onClick={() => copyToClipboard(url)}
              className="p-1.5 hover:bg-navy/5 rounded-md text-navy/60 hover:text-navy"
              title="Copy URL"
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={() => setEventsOpen((o) => !o)}
              className="text-xs text-navy/55 hover:text-navy inline-flex items-center gap-1"
            >
              Activity {eventsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {eventsOpen && <EventList events={status?.events ?? []} now={now} />}
        </div>
      </div>

      <PiSetupDialog
        open={piOpen}
        onOpenChange={setPiOpen}
        display={{ id: d.id, name: d.name, orientation }}
        baseUrl={baseUrl}
      />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-navy/45 font-medium mb-0.5">{label}</div>
      {children}
    </div>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'warn'; children: React.ReactNode }) {
  return (
    <div
      className={`text-xs rounded-md px-2.5 py-1.5 flex items-center gap-1.5 ${
        tone === 'warn' ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-navy/5 text-navy/75'
      }`}
    >
      {children}
    </div>
  );
}

function EventList({ events, now }: { events: DisplayEvent[]; now: number }) {
  if (events.length === 0) {
    return <p className="mt-3 text-xs text-navy/45 italic">No activity recorded yet.</p>;
  }
  const fmt = (v: string | Date) =>
    new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <ul className="mt-3 space-y-1 text-xs text-navy/70">
      {events.map((e) => {
        const at = String(e.at);
        let text: React.ReactNode;
        if (e.kind === 'offline') {
          const end = e.resolvedAt ? new Date(e.resolvedAt).getTime() : now;
          const dur = formatDuration((end - new Date(at).getTime()) / 1000);
          text = e.resolvedAt ? (
            <>
              <span className="text-rust font-medium">Down</span> {fmt(at)} → {fmt(e.resolvedAt)} ({dur})
              {e.alertedAt ? ' · emailed' : ''}
            </>
          ) : (
            <>
              <span className="text-rust font-medium">Down</span> since {fmt(at)} ({dur} so far)
              {e.alertedAt ? ' · emailed' : ''}
            </>
          );
        } else if (e.kind === 'command') {
          const m = (e.meta ?? {}) as { command?: string; by?: string | null };
          text = (
            <>
              <span className="font-medium">{m.command ?? 'command'}</span> requested {fmt(at)}
              {m.by ? ` by ${m.by}` : ''}
            </>
          );
        } else if (e.kind === 'screenshot') {
          text = <>Screenshot taken {fmt(at)}</>;
        } else if (e.kind === 'agent_installed') {
          const m = (e.meta ?? {}) as { hostname?: string | null };
          text = <>Raspberry Pi agent first checked in {fmt(at)}{m.hostname ? ` (${m.hostname})` : ''}</>;
        } else {
          text = <>{e.kind} {fmt(at)}</>;
        }
        return (
          <li key={e.id} className="flex gap-2">
            <span className="text-navy/30">·</span>
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}
