'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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

export function EmailImport() {
  const [source, setSource] = useState('');
  const [parsing, setParsing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [collectionName, setCollectionName] = useState(defaultCollectionName);
  const [deactivatePrevious, setDeactivatePrevious] = useState(true);
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState<{ created: number; deactivated: number; collectionId: string } | null>(null);

  const included = useMemo(() => drafts.filter((d) => d.include), [drafts]);

  async function parse() {
    if (!source.trim()) return;
    setParsing(true);
    setDone(null);
    try {
      const res = await fetch('/api/import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source }),
      });
      const data = (await res.json()) as { items?: ParsedItem[]; error?: string };
      if (!res.ok || !data.items) throw new Error(data.error ?? 'Parsing failed');
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
      toast.success(`Found ${data.items.length} section${data.items.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Parsing failed');
    } finally {
      setParsing(false);
    }
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
    setCreating(true);
    try {
      const res = await fetch('/api/import/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName,
          deactivatePrevious,
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
      const data = (await res.json()) as { created?: number; deactivated?: number; collectionId?: string; error?: string };
      if (!res.ok || data.created === undefined) throw new Error(data.error ?? 'Could not create slides');
      setDone({ created: data.created, deactivated: data.deactivated ?? 0, collectionId: data.collectionId ?? '' });
      toast.success(`${data.created} slides created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create slides');
    } finally {
      setCreating(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-navy/15 bg-cream p-6 space-y-3">
        <p className="font-serif text-2xl text-navy">This week is on the screens.</p>
        <p className="text-sm text-navy/70">
          {done.created} slide{done.created === 1 ? '' : 's'} created in “{collectionName}”
          {done.deactivated > 0 ? `, and ${done.deactivated} from the previous email turned off` : ''}.
          The TVs pick up the change within a minute.
        </p>
        <div className="flex gap-2">
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            href={'/admin/slides' as any}
            className="inline-flex h-9 items-center rounded-lg bg-navy px-4 text-sm font-medium text-cream"
          >
            Open Slides
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              setDone(null);
              setDrafts([]);
              setSource('');
              setCollectionName(defaultCollectionName());
            }}
          >
            Import another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Step 1: paste */}
      <section className="rounded-xl border border-navy/15 bg-cream p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-serif text-lg font-semibold text-navy">1. Paste the email</h2>
            <p className="text-sm text-navy/55">
              In HubSpot open the sent email, choose Actions → View source (or copy the web
              version), and paste everything here. Plain text works too.
            </p>
          </div>
          <Button onClick={parse} disabled={parsing || !source.trim()} className="bg-rust text-cream hover:bg-rust-700 gap-2">
            <Sparkles size={14} />
            {parsing ? 'Reading…' : drafts.length ? 'Read again' : 'Read the email'}
          </Button>
        </div>
        <Textarea
          rows={drafts.length ? 4 : 12}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="<!DOCTYPE html> … or the plain text of the email"
          className="font-mono text-xs"
        />
      </section>

      {/* Step 2: review */}
      {drafts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-serif text-lg font-semibold text-navy">2. Check each slide</h2>
              <p className="text-sm text-navy/55">
                Copy is exactly as written in the email. Untick anything that shouldn&apos;t go on
                the screens; letters and boilerplate start unticked.
              </p>
            </div>
            <span className="text-sm text-navy/60">
              {included.length} of {drafts.length} selected
            </span>
          </div>

          {drafts.map((d, i) => (
            <div
              key={d.id}
              className={`rounded-xl border p-4 bg-cream grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 ${
                d.include ? 'border-navy/15' : 'border-navy/10 opacity-60'
              }`}
            >
              <div className="space-y-3 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <Switch checked={d.include} onCheckedChange={(v) => update(d.id, { include: v })} />
                  <span className="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-navy/8 text-navy/60">
                    {d.kind}
                  </span>
                  <span className="text-xs text-navy/40">#{i + 1}</span>
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
                    <Label className="text-xs">Subtitle (date, time, place)</Label>
                    <Input value={d.subtitle} onChange={(e) => update(d.id, { subtitle: e.target.value })} placeholder="Sunday, October 12 · 7:00 PM · Meaney Hall" />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Body (blank line between paragraphs)</Label>
                    <Textarea rows={5} value={d.paragraphs} onChange={(e) => update(d.id, { paragraphs: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Call to action (its own line)</Label>
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
                    <Label className="text-xs">Turn off the morning after the event</Label>
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

      {/* Step 3: create */}
      {drafts.length > 0 && (
        <section className="rounded-xl border border-navy/15 bg-cream p-5 space-y-4">
          <h2 className="font-serif text-lg font-semibold text-navy">3. Put them on the screens</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Collection name</Label>
              <Input value={collectionName} onChange={(e) => setCollectionName(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <Switch checked={deactivatePrevious} onCheckedChange={setDeactivatePrevious} />
              <Label className="text-sm">Turn off last week&apos;s email slides</Label>
            </div>
          </div>
          <p className="text-xs text-navy/50">
            Slides go live immediately in the normal rotation. Slides with an event date and the
            switch on turn themselves off the morning after. Everything is editable afterwards
            on the Slides page.
          </p>
          <Button onClick={create} disabled={creating || included.length === 0} className="bg-navy text-cream">
            {creating ? 'Creating…' : `Create ${included.length} slide${included.length === 1 ? '' : 's'}`}
          </Button>
        </section>
      )}
    </div>
  );
}
