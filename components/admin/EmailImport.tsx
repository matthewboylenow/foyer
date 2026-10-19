'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { htmlToText } from '@/lib/import/html-to-text';
import { LivePreview } from './LivePreview';
import type { GeneralContent } from '@/lib/db/schema';

interface Draft {
  id: string;
  heading: string;
  subtitle: string;
  paragraphs: string;
  cta: string;
  ctaUrl: string;
  eventDate: string;
  expireAfterEvent: boolean;
  include: boolean;
  kind: 'announcement' | 'letter' | 'other';
}

interface ParsedItem {
  heading: string;
  subtitle: string;
  paragraphs: string[];
  cta: string;
  ctaUrl: string;
  eventDate: string;
  kind: 'announcement' | 'letter' | 'other';
}

type Phase = 'paste' | 'reading' | 'review' | 'creating' | 'done';

interface TextStats {
  words: number;
  headings: number;
  links: number;
}

const TOAST_ID = 'email-import';

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function draftToContent(d: Draft): GeneralContent {
  const paras = d.paragraphs
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`);
  if (d.cta.trim()) paras.push(`<p><strong>${esc(d.cta.trim())}</strong></p>`);
  return {
    templateType: 'general',
    headline: d.heading,
    headlineSize: 'small',
    meta: d.subtitle,
    body: paras.join(''),
    eventDate: d.eventDate || undefined,
    qrUrl: d.ctaUrl.trim() || undefined,
    qrLabel: d.ctaUrl.trim() ? 'Scan to visit' : undefined,
    motionStyle: 'lineMask',
    textMode: 'dark',
  };
}

function defaultCollectionName() {
  return `Email blast · ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function statsFor(source: string): TextStats {
  const text = htmlToText(source);
  const words = text.split(/\s+/).filter(Boolean).length;
  const headings = text.split('\n').filter((l) => l.startsWith('# ')).length;
  const links = (text.match(/\(https?:\/\//g) ?? []).length;
  return { words, headings, links };
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** Counts seconds while `running`; resets when it starts again. */
function useElapsed(running: boolean) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    setSec(0);
    const started = Date.now();
    const t = setInterval(() => setSec(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);
  return sec;
}

export function EmailImport() {
  const [phase, setPhase] = useState<Phase>('paste');
  const [source, setSource] = useState('');
  const [stats, setStats] = useState<TextStats | null>(null);
  const [readSeconds, setReadSeconds] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [collectionName, setCollectionName] = useState(defaultCollectionName);
  const [deactivatePrevious, setDeactivatePrevious] = useState(true);
  const [publishNow, setPublishNow] = useState(true);
  const [done, setDone] = useState<{ created: number; deactivated: number; published: boolean } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const elapsed = useElapsed(phase === 'reading');
  const included = useMemo(() => drafts.filter((d) => d.include), [drafts]);

  // Stats update as the paste changes so the button can say what it will read.
  useEffect(() => {
    if (!source.trim()) {
      setStats(null);
      return;
    }
    const t = setTimeout(() => setStats(statsFor(source)), 150);
    return () => clearTimeout(t);
  }, [source]);

  async function read(text: string) {
    if (!text.trim()) return;
    const s = statsFor(text);
    setStats(s);
    if (s.words < 8) {
      toast.error('Nothing readable in that paste', { id: TOAST_ID });
      return;
    }
    setPhase('reading');
    setDone(null);
    setReadSeconds(null);
    toast.loading(`Reading ${plural(s.words, 'word')}…`, {
      id: TOAST_ID,
      description: 'Claude reads the whole email. Usually 30 to 60 seconds.',
    });
    const controller = new AbortController();
    abortRef.current = controller;
    const started = Date.now();
    try {
      const res = await fetch('/api/import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: text }),
        signal: controller.signal,
      });
      const data = (await res.json()) as { items?: ParsedItem[]; error?: string };
      if (!res.ok || !data.items) throw new Error(data.error ?? 'Reading failed');
      const secs = Math.round((Date.now() - started) / 1000);
      setReadSeconds(secs);
      setDrafts(
        data.items.map((it, i) => ({
          id: `${Date.now()}-${i}`,
          heading: it.heading,
          subtitle: it.subtitle,
          paragraphs: it.paragraphs.join('\n\n'),
          cta: it.cta,
          ctaUrl: it.ctaUrl,
          eventDate: it.eventDate,
          expireAfterEvent: !!it.eventDate,
          include: it.kind === 'announcement',
          kind: it.kind,
        })),
      );
      const announcements = data.items.filter((i) => i.kind === 'announcement').length;
      toast.success(`Found ${plural(data.items.length, 'section')} in ${secs}s`, {
        id: TOAST_ID,
        description:
          announcements === data.items.length
            ? 'All of them look like announcements.'
            : announcements === 1
              ? '1 looks like an announcement; the rest start unticked.'
              : `${announcements} look like announcements; the rest start unticked.`,
      });
      setPhase('review');
    } catch (err) {
      if (controller.signal.aborted) {
        toast.dismiss(TOAST_ID);
      } else {
        toast.error(err instanceof Error ? err.message : 'Reading failed', { id: TOAST_ID, duration: 8000 });
      }
      setPhase('paste');
    } finally {
      abortRef.current = null;
    }
  }

  function cancelRead() {
    abortRef.current?.abort();
  }

  // Pasting a whole email into the empty box starts the read on its own.
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (source.trim()) return;
    const pasted = e.clipboardData.getData('text/plain');
    if (pasted.length < 400) return;
    e.preventDefault();
    setSource(pasted);
    void read(pasted);
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function move(id: string, dir: -1 | 1) {
    setDrafts((prev) => {
      const i = prev.findIndex((d) => d.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function create() {
    if (included.length === 0) return;
    setPhase('creating');
    toast.loading(`Creating ${plural(included.length, 'slide')}…`, {
      id: TOAST_ID,
      description: deactivatePrevious ? "Turning off last week's email slides first." : undefined,
    });
    try {
      const res = await fetch('/api/import/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName,
          deactivatePrevious,
          publish: publishNow,
          items: included.map((d) => ({
            heading: d.heading,
            subtitle: d.subtitle,
            paragraphs: d.paragraphs.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
            cta: d.cta,
            ctaUrl: d.ctaUrl,
            eventDate: d.eventDate,
            expireAfterEvent: d.expireAfterEvent,
          })),
        }),
      });
      const data = (await res.json()) as { created?: number; deactivated?: number; published?: boolean; error?: string };
      if (!res.ok || data.created === undefined) throw new Error(data.error ?? 'Could not create slides');
      setDone({ created: data.created, deactivated: data.deactivated ?? 0, published: !!data.published });
      toast.success(data.published ? `${plural(data.created, 'slide')} on the screens` : `${plural(data.created, 'slide')} staged`, {
        id: TOAST_ID,
        description: data.published ? 'The TVs switch within a minute.' : 'Press Publish on the Slides page when ready.',
      });
      setPhase('done');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create slides', { id: TOAST_ID, duration: 8000 });
      setPhase('review');
    }
  }

  function reset() {
    setPhase('paste');
    setDone(null);
    setDrafts([]);
    setSource('');
    setStats(null);
    setReadSeconds(null);
    setCollectionName(defaultCollectionName());
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  // ── Done ────────────────────────────────────────────────────────────────
  if (phase === 'done' && done) {
    return (
      <div className="max-w-xl rounded-xl border border-navy/15 bg-cream p-6 space-y-3">
        <p className="font-serif text-2xl text-navy">
          {done.published ? 'On the screens.' : 'Staged, not published yet.'}
        </p>
        <p className="text-sm text-navy/70">
          {plural(done.created, 'slide')} in “{collectionName}”
          {done.deactivated > 0 ? `; ${done.deactivated} from the previous email turned off` : ''}.
          {done.published ? ' The TVs switch within a minute.' : ' Press Publish on the Slides page to put them on the TVs.'}
        </p>
        <div className="flex gap-2 pt-1">
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={'/admin/slides' as any}
            className="inline-flex h-9 items-center rounded-lg bg-navy px-4 text-sm font-medium text-cream"
          >
            Open Slides
          </Link>
          <Button variant="outline" onClick={reset}>
            Import another email
          </Button>
        </div>
      </div>
    );
  }

  const reading = phase === 'reading';
  const reviewing = phase === 'review' || phase === 'creating';

  return (
    <div className="space-y-8">
      {/* Paste / progress / summary */}
      {!reviewing ? (
        <section className="max-w-3xl space-y-3">
          <Textarea
            ref={textareaRef}
            rows={reading ? 3 : 12}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onPaste={handlePaste}
            disabled={reading}
            autoFocus
            placeholder="Paste the email here. In HubSpot: open the sent email, Actions, View source. Plain text works too."
            className="font-mono text-xs"
          />

          {reading ? (
            <ProgressPanel stats={stats} elapsed={elapsed} onCancel={cancelRead} />
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={() => read(source)} disabled={!source.trim()} className="bg-rust text-cream hover:bg-rust-700">
                Read the email
              </Button>
              <span className="text-sm text-navy/55">
                {stats
                  ? `${plural(stats.words, 'word')}, ${plural(stats.headings, 'heading')}, ${plural(stats.links, 'link')} after stripping the HTML.`
                  : 'Pasting a whole email starts the read automatically.'}
              </span>
            </div>
          )}
        </section>
      ) : (
        <section className="flex items-center gap-3 flex-wrap text-sm text-navy/70">
          <Check size={16} className="text-emerald-600" />
          <span>
            Read {stats ? plural(stats.words, 'word') : 'the email'}
            {readSeconds !== null ? ` in ${readSeconds}s` : ''}: {plural(drafts.length, 'section')}, {included.length} ticked.
          </span>
          <button type="button" onClick={reset} className="text-rust underline underline-offset-2" disabled={phase === 'creating'}>
            Start over
          </button>
        </section>
      )}

      {/* Review */}
      {reviewing && (
        <section className="space-y-4">
          {drafts.map((d, i) => (
            <div
              key={d.id}
              className={`rounded-xl border p-4 bg-cream grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 ${
                d.include ? 'border-navy/15' : 'border-navy/10 opacity-60'
              }`}
            >
              <div className="space-y-3 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <Switch checked={d.include} onCheckedChange={(v) => update(d.id, { include: v })} aria-label="Include this slide" />
                  <span className="text-sm text-navy/60">
                    {d.include ? 'On the screens' : 'Skipped'}
                    {d.kind !== 'announcement' ? ` · looks like a ${d.kind}` : ''}
                  </span>
                  <span className="text-xs text-navy/40">{i + 1} of {drafts.length}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => move(d.id, -1)} className="p-1 text-navy/50 hover:text-navy" aria-label="Move up">
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" onClick={() => move(d.id, 1)} className="p-1 text-navy/50 hover:text-navy" aria-label="Move down">
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrafts((prev) => prev.filter((x) => x.id !== d.id))}
                      className="p-1 text-navy/50 hover:text-rust"
                      aria-label="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Heading</Label>
                    <Input value={d.heading} onChange={(e) => update(d.id, { heading: e.target.value })} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Date, time, place</Label>
                    <Input value={d.subtitle} onChange={(e) => update(d.id, { subtitle: e.target.value })} placeholder="Sunday, October 12 · 7:00 PM · Meaney Hall" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Body</Label>
                    <Textarea rows={5} value={d.paragraphs} onChange={(e) => update(d.id, { paragraphs: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Call to action</Label>
                    <Input value={d.cta} onChange={(e) => update(d.id, { cta: e.target.value })} placeholder="To sign up, visit sainthelen.org/fest." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Link (becomes a QR code)</Label>
                    <Input value={d.ctaUrl} onChange={(e) => update(d.id, { ctaUrl: e.target.value })} placeholder="https://sainthelen.org/fest" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Event date</Label>
                    <Input type="date" value={d.eventDate} onChange={(e) => update(d.id, { eventDate: e.target.value, expireAfterEvent: !!e.target.value && d.expireAfterEvent })} />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <Switch
                      checked={d.expireAfterEvent && !!d.eventDate}
                      disabled={!d.eventDate}
                      onCheckedChange={(v) => update(d.id, { expireAfterEvent: v })}
                    />
                    <Label className="text-xs">Turn off the morning after</Label>
                  </div>
                </div>
              </div>
              <div className="lg:pl-2">
                <LivePreview templateType="general" content={draftToContent(d)} orientation="portrait" width={200} />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Create */}
      {reviewing && (
        <section className="sticky bottom-0 -mx-4 sm:-mx-8 px-4 sm:px-8 py-4 bg-cream/95 backdrop-blur border-t border-navy/10">
          <div className="flex items-center gap-x-6 gap-y-3 flex-wrap">
            <Button
              onClick={create}
              disabled={phase === 'creating' || included.length === 0}
              className="bg-rust text-cream hover:bg-rust-700 min-w-44"
            >
              {phase === 'creating' ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Creating…
                </>
              ) : publishNow ? (
                `Put ${plural(included.length, 'slide')} on the screens`
              ) : (
                `Stage ${plural(included.length, 'slide')}`
              )}
            </Button>
            <label className="flex items-center gap-2 text-sm text-navy/80">
              <Switch checked={publishNow} onCheckedChange={setPublishNow} />
              Publish right away
            </label>
            <label className="flex items-center gap-2 text-sm text-navy/80">
              <Switch checked={deactivatePrevious} onCheckedChange={setDeactivatePrevious} />
              Turn off last week&apos;s email slides
            </label>
            <label className="flex items-center gap-2 text-sm text-navy/80 ml-auto">
              <span className="text-navy/55">Collection</span>
              <Input value={collectionName} onChange={(e) => setCollectionName(e.target.value)} className="h-8 w-52 text-sm" />
            </label>
          </div>
        </section>
      )}
    </div>
  );
}

/** What is happening while the email is being read, with a running clock. */
function ProgressPanel({ stats, elapsed, onCancel }: { stats: TextStats | null; elapsed: number; onCancel: () => void }) {
  const slow = elapsed > 75;
  return (
    <div className="rounded-xl border border-navy/15 bg-cream p-4 space-y-3" role="status" aria-live="polite">
      <ol className="space-y-2 text-sm">
        <li className="flex items-center gap-2 text-navy/70">
          <Check size={15} className="text-emerald-600 shrink-0" />
          Stripped the HTML
          {stats ? `: ${plural(stats.words, 'word')}, ${plural(stats.headings, 'heading')}, ${plural(stats.links, 'link')}` : ''}
        </li>
        <li className="flex items-center gap-2 text-navy">
          <Loader2 size={15} className="animate-spin text-rust shrink-0" />
          <span className="font-medium">Picking out the announcements</span>
          <span className="font-mono text-xs text-navy/50 tabular-nums">{elapsed}s</span>
        </li>
        <li className="flex items-center gap-2 text-navy/40">
          <span className="size-[15px] rounded-full border border-navy/25 shrink-0" />
          Review each slide
        </li>
      </ol>
      <div className="h-1 rounded-full bg-navy/10 overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-rust indeterminate-bar" />
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-navy/55">
        <span>
          {slow
            ? 'Taking longer than usual. Long emails can take up to two minutes.'
            : 'Claude reads the whole email and keeps the wording as written. Usually 30 to 60 seconds.'}
        </span>
        <button type="button" onClick={onCancel} className="underline underline-offset-2 hover:text-navy">
          Cancel
        </button>
      </div>
    </div>
  );
}
