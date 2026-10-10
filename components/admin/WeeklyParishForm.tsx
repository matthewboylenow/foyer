'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PasteParser } from './PasteParser';
import { LivePreview } from './LivePreview';
import { notifySlidesChanged } from './PublishBar';
import type {
  Slide,
  MassScheduleContent,
  MassScheduleRow,
  WeeklyAssociationContent,
  SanctuaryCandleContent,
} from '@/lib/db/schema';

export interface WeeklySlides {
  intentions: Slide | null;
  association: Slide | null;
  candle: Slide | null;
}

export interface WeeklyMedia {
  intentions?: string | null;
  association?: string | null;
  candle?: string | null;
}

/** "Weekend of October 11 / 12" for the coming Saturday/Sunday. */
function nextWeekendLabel(from = new Date()): string {
  const d = new Date(from);
  const day = d.getDay(); // 0 Sun … 6 Sat
  const toSat = day === 6 ? 0 : (6 - day) % 7;
  const sat = new Date(d);
  sat.setDate(d.getDate() + toSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  const month = sat.toLocaleDateString('en-US', { month: 'long' });
  const sameMonth = sat.getMonth() === sun.getMonth();
  return sameMonth
    ? `Weekend of ${month} ${sat.getDate()} / ${sun.getDate()}`
    : `Weekend of ${month} ${sat.getDate()} / ${sun.toLocaleDateString('en-US', { month: 'long' })} ${sun.getDate()}`;
}

function massContent(s: Slide | null): MassScheduleContent {
  const c = (s?.content ?? {}) as Partial<MassScheduleContent>;
  const weekendRows = c.weekendRows ?? (c.scheduleKind === 'weekend' ? c.rows ?? [] : []);
  const weekdayRows = c.weekdayRows ?? (c.scheduleKind === 'weekday' ? c.rows ?? [] : []);
  return { ...c, templateType: 'mass_schedule', weekendLabel: c.weekendLabel ?? '', weekendRows, weekdayRows };
}

export function WeeklyParishForm({ slides, media }: { slides: WeeklySlides; media: WeeklyMedia }) {
  const router = useRouter();
  const initialMass = useMemo(() => massContent(slides.intentions), [slides.intentions]);
  const initialAssoc = (slides.association?.content ?? { templateType: 'weekly_association', names: [] }) as WeeklyAssociationContent;
  const initialCandle = (slides.candle?.content ?? { templateType: 'sanctuary_candle', name: '', inMemoryOf: true }) as SanctuaryCandleContent;

  const [weekendLabel, setWeekendLabel] = useState(initialMass.weekendLabel ?? '');
  const [weekendRows, setWeekendRows] = useState<MassScheduleRow[]>(initialMass.weekendRows ?? []);
  const [weekdayRows, setWeekdayRows] = useState<MassScheduleRow[]>(initialMass.weekdayRows ?? []);
  const [names, setNames] = useState<string[]>(initialAssoc.names ?? []);
  const [candleName, setCandleName] = useState(initialCandle.name ?? '');
  const [inMemoryOf, setInMemoryOf] = useState(initialCandle.inMemoryOf ?? true);
  const [saving, setSaving] = useState(false);

  const massPreview: MassScheduleContent = { ...initialMass, weekendLabel, weekendRows, weekdayRows };
  const assocPreview: WeeklyAssociationContent = { ...initialAssoc, names };
  const candlePreview: SanctuaryCandleContent = { ...initialCandle, name: candleName, inMemoryOf };

  async function upsert(slide: Slide | null, templateType: string, title: string, content: unknown) {
    if (slide) {
      const res = await fetch(`/api/slides/${slide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error(`Couldn't save ${title}`);
      return;
    }
    const res = await fetch('/api/slides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, templateType, content, active: true, pin: 'end', scheduleType: 'evergreen' }),
    });
    if (!res.ok) throw new Error(`Couldn't create ${title}`);
  }

  async function save(publish: boolean) {
    setSaving(true);
    try {
      await upsert(slides.intentions, 'mass_schedule', 'Mass Intentions', {
        ...initialMass,
        weekendLabel: weekendLabel.trim() || undefined,
        weekendRows,
        weekdayRows,
        // Legacy single-section fields are superseded by the two lists.
        scheduleKind: undefined,
        rows: undefined,
      });
      await upsert(slides.association, 'weekly_association', 'Weekly Mass Association', { ...initialAssoc, names });
      await upsert(slides.candle, 'sanctuary_candle', 'Sanctuary Candle', { ...initialCandle, name: candleName.trim(), inMemoryOf });
      if (publish) {
        const pub = await fetch('/api/publish', { method: 'POST' });
        if (!pub.ok) throw new Error('Saved, but publishing failed');
        toast.success('Saved and published — on the screens within a minute');
      } else {
        toast.success('Saved (not on the screens until you publish)');
      }
      notifySlidesChanged();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Mass Intentions */}
        <section className="rounded-xl border border-navy/15 bg-cream p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0 space-y-4">
              <h2 className="font-serif text-lg font-semibold text-navy">Mass intentions</h2>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Weekend label</Label>
                  <button
                    type="button"
                    onClick={() => setWeekendLabel(nextWeekendLabel())}
                    className="text-xs text-rust hover:underline"
                  >
                    Use this weekend
                  </button>
                </div>
                <Input value={weekendLabel} onChange={(e) => setWeekendLabel(e.target.value)} placeholder="Weekend of October 11 / 12" />
              </div>
            </div>
            <LivePreview templateType="mass_schedule" content={massPreview} orientation="portrait" width={150} bgImageUrl={media.intentions ?? null} />
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-navy/50">Weekend Masses</p>
            <PasteParser
              templateType="mass_schedule_weekend"
              savedRows={weekendRows.map((r) => ({ ...r, needsReview: false }))}
              onParsed={(rows) => setWeekendRows(rows.map(({ needsReview: _n, ...r }) => r) as MassScheduleRow[])}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-navy/50">Daily Mass intentions</p>
            <PasteParser
              templateType="mass_schedule_weekday"
              savedRows={weekdayRows.map((r) => ({ ...r, needsReview: false }))}
              onParsed={(rows) => setWeekdayRows(rows.map(({ needsReview: _n, ...r }) => r) as MassScheduleRow[])}
            />
          </div>
        </section>

        {/* Mass Association */}
        <section className="rounded-xl border border-navy/15 bg-cream p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-lg font-semibold text-navy">Mass association</h2>
              <p className="text-sm text-navy/55 mt-1">Paste this week&apos;s names, one per line.</p>
            </div>
            <LivePreview templateType="weekly_association" content={assocPreview} orientation="portrait" width={150} bgImageUrl={media.association ?? null} />
          </div>
          <PasteParser
            templateType="weekly_association"
            savedRows={names.map((name) => ({ name, needsReview: false }))}
            onParsed={(rows) => setNames((rows as { name: string }[]).map((r) => r.name))}
          />
        </section>

        {/* Sanctuary Candle */}
        <section className="rounded-xl border border-navy/15 bg-cream p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0 space-y-4">
              <h2 className="font-serif text-lg font-semibold text-navy">Sanctuary candle</h2>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={candleName} onChange={(e) => setCandleName(e.target.value)} placeholder="Terry Vinanskie" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={inMemoryOf} onCheckedChange={setInMemoryOf} />
                <Label className="text-sm">{inMemoryOf ? 'In memory of' : 'In honor of'}</Label>
              </div>
            </div>
            <LivePreview templateType="sanctuary_candle" content={candlePreview} orientation="portrait" width={150} bgImageUrl={media.candle ?? null} />
          </div>
        </section>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={() => save(true)} disabled={saving} className="bg-rust text-cream hover:bg-rust-700">
          {saving ? 'Saving…' : 'Save & publish to screens'}
        </Button>
        <Button onClick={() => save(false)} disabled={saving} variant="outline">
          Save only
        </Button>
        <p className="text-xs text-navy/50">
          These three play at the end of every loop. Backgrounds and other settings are on each
          slide&apos;s full editor.
        </p>
      </div>
    </div>
  );
}
