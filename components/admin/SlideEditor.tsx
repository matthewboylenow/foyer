'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ActiveToggle } from './ActiveToggle';
import { TimePicker } from './TimePicker';
import { PasteParser } from './PasteParser';
import { LivePreview } from './LivePreview';
import { ImageUpload } from './ImageUpload';
import { VideoUpload } from './VideoUpload';
import { SizeButtons } from './SizeButtons';
import { PercentageSlider } from './PercentageSlider';
import { RichTextEditor } from './RichTextEditor';
import { resolveLogoPercent } from '@/components/templates/sizing';
import { templates } from '@/components/templates';
import type { TemplateKey } from '@/components/templates';
import type { SlideWithContent, SlideContent, MassScheduleRow, SizePreset } from '@/lib/db/schema';
import type { TimeValue } from '@/lib/time';

interface SlideEditorProps {
  templateType: TemplateKey;
  initialSlide: SlideWithContent | null;
  tenantLogoUrl?: string | null;
  displays?: { id: string; name: string }[];
  initialMedia?: {
    logoUrl?: string | null;
    bgImageUrl?: string | null;
    bgVideoUrl?: string | null;
    phoneMockupUrl?: string | null;
  };
}

function defaultContent(templateType: TemplateKey): SlideContent {
  switch (templateType) {
    case 'parish_identity':
      return { templateType, headline: '', subline: '' };
    case 'welcome_quote':
      return { templateType, quote: '', attribution: '' };
    case 'general':
      return { templateType, headline: '', body: '', meta: '', motionStyle: 'lineMask' };
    case 'mass_schedule':
      return { templateType, scheduleKind: 'weekend', rows: [] };
    case 'weekly_association':
      return { templateType, names: [] };
    case 'sanctuary_candle':
      return { templateType, name: '', inMemoryOf: true };
    case 'app_promo':
      return { templateType, headline: 'Your Parish in Your Pocket', body: 'Mass readings. Livestreams. All in one app.', url: 'sainthelen.org/app' };
  }
}

export function SlideEditor({
  templateType,
  initialSlide,
  tenantLogoUrl,
  displays = [],
  initialMedia,
}: SlideEditorProps) {
  const router = useRouter();
  const isNew = !initialSlide;

  const [title, setTitle] = useState(initialSlide?.title ?? '');
  const [content, setContent] = useState<SlideContent>(
    (initialSlide?.content as SlideContent) ?? defaultContent(templateType),
  );
  const [scheduleType, setScheduleType] = useState<'evergreen' | 'dated'>(
    initialSlide?.scheduleType ?? 'evergreen',
  );
  const [startDate, setStartDate] = useState(
    initialSlide?.startAt ? new Date(initialSlide.startAt).toISOString().split('T')[0] : '',
  );
  const [startTime, setStartTime] = useState<TimeValue>({ hour: 12, minute: 0, period: 'AM' });
  const [endDate, setEndDate] = useState(
    initialSlide?.endAt ? new Date(initialSlide.endAt).toISOString().split('T')[0] : '',
  );
  const [endTime, setEndTime] = useState<TimeValue>({ hour: 11, minute: 59, period: 'PM' });
  const [weight, setWeight] = useState(String(initialSlide?.weight ?? 1));
  const [durationOverride, setDurationOverride] = useState(
    initialSlide?.durationOverrideSec ? String(initialSlide.durationOverrideSec) : '',
  );
  const [active, setActive] = useState(initialSlide?.active ?? true);
  const [targetDisplays, setTargetDisplays] = useState<string[]>(
    (initialSlide?.targetDisplays as string[]) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [savedState, setSavedState] = useState<'idle' | 'saved' | 'error'>('idle');
  // Track resolved media URLs for live preview (not persisted — looked up server-side from IDs)
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(initialMedia?.bgImageUrl ?? null);
  const [bgVideoUrl, setBgVideoUrl] = useState<string | null>(initialMedia?.bgVideoUrl ?? null);
  const [phoneMockupUrl, setPhoneMockupUrl] = useState<string | null>(initialMedia?.phoneMockupUrl ?? null);
  const [slideLogoUrl, setSlideLogoUrl] = useState<string | null>(initialMedia?.logoUrl ?? null);

  const templateConfig = templates[templateType];

  function buildBody() {
    const body: Record<string, unknown> = {
      title,
      templateType,
      content,
      scheduleType,
      active,
      weight: parseFloat(weight) || 1,
      durationOverrideSec: durationOverride ? parseInt(durationOverride) : null,
      targetDisplays,
    };

    if (scheduleType === 'dated') {
      if (startDate) {
        const d = new Date(startDate);
        let h = startTime.hour % 12;
        if (startTime.period === 'PM') h += 12;
        d.setHours(h, startTime.minute, 0, 0);
        body.startAt = d.toISOString();
      }
      if (endDate) {
        const d = new Date(endDate);
        let h = endTime.hour % 12;
        if (endTime.period === 'PM') h += 12;
        d.setHours(h, endTime.minute, 0, 0);
        body.endAt = d.toISOString();
      }
    } else {
      body.startAt = null;
      body.endAt = null;
    }

    return body;
  }

  async function handleSave() {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    setSavedState('idle');

    try {
      const body = buildBody();
      let res: Response;

      if (isNew) {
        res = await fetch('/api/slides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch(`/api/slides/${initialSlide.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) throw new Error(await res.text());

      const saved = await res.json();
      setSavedState('saved');
      toast.success('Saved');

      if (isNew) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        router.push(`/admin/slides/${saved.id}` as any);
      }
    } catch (err) {
      setSavedState('error');
      toast.error(`Couldn't save: ${err instanceof Error ? err.message : 'Unknown error'}`, {
        action: { label: 'Retry', onClick: handleSave },
      });
    } finally {
      setSaving(false);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateContent = useCallback((key: string, value: unknown) => {
    setContent((prev) => ({ ...prev, [key]: value } as SlideContent));
  }, []);

  return (
    <div>
      {/* Sticky header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-serif font-bold text-navy truncate">
            {isNew ? `New ${templateConfig.label}` : title || 'Untitled'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {savedState === 'saved' ? 'Saved' : savedState === 'error' ? 'Error saving' : templateConfig.label}
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-rust hover:bg-rust-700 text-cream shrink-0"
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left: Content form (60%) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="space-y-1">
            <Label htmlFor="title">Internal title (not shown on display)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Easter Mass Schedule 2025"
              required
            />
          </div>

          <Separator />

          {/* Template-specific fields */}
          <TemplateFields
            templateType={templateType}
            content={content}
            onChange={(c) => setContent(c)}
            bgImageUrl={bgImageUrl}
            onBgImageChange={setBgImageUrl}
            bgVideoUrl={bgVideoUrl}
            onBgVideoChange={setBgVideoUrl}
            phoneMockupUrl={phoneMockupUrl}
            onPhoneMockupChange={setPhoneMockupUrl}
            slideLogoUrl={slideLogoUrl}
            onSlideLogoChange={setSlideLogoUrl}
          />
        </div>

        {/* Right: Schedule + settings (40%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live preview */}
          <div className="p-4 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Preview</h3>
              {!isNew && initialSlide && (
                <a
                  href={`/display/__preview?slideId=${initialSlide.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-navy underline"
                >
                  Full size ↗
                </a>
              )}
            </div>
            <LivePreview
              templateType={templateType}
              content={content}
              logoUrl={slideLogoUrl ?? tenantLogoUrl ?? null}
              bgImageUrl={bgImageUrl}
              bgVideoUrl={bgVideoUrl}
              phoneMockupUrl={phoneMockupUrl}
              width={280}
            />
            <p className="text-[11px] text-muted-foreground mt-2">
              Live preview at 26% scale. Animations replay 500ms after you stop typing.
            </p>
          </div>

          {/* Active toggle */}
          {!isNew && initialSlide && (
            <div className="p-4 border border-border rounded-lg">
              <ActiveToggle
                slideId={initialSlide.id}
                initialActive={active}
                onToggle={setActive}
              />
            </div>
          )}
          {isNew && (
            <div className="p-4 border border-border rounded-lg">
              <div className="flex items-center gap-3">
                <Switch checked={active} onCheckedChange={setActive} />
                <Label>Active when saved</Label>
              </div>
            </div>
          )}

          {/* Schedule type */}
          <div className="p-4 border border-border rounded-lg space-y-4">
            <h3 className="font-medium text-sm">Schedule</h3>
            <div className="flex gap-4">
              {(['evergreen', 'dated'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleType"
                    value={t}
                    checked={scheduleType === t}
                    onChange={() => setScheduleType(t)}
                    className="accent-rust"
                  />
                  <span className="text-sm capitalize">{t}</span>
                </label>
              ))}
            </div>

            {scheduleType === 'dated' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Leave Start blank for &ldquo;starts now&rdquo;. Leave End blank to run forever once started.
                </p>
                <div className="space-y-1">
                  <Label className="text-xs">Start date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <TimePicker value={startTime} onChange={setStartTime} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End date (optional)</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <TimePicker value={endTime} onChange={setEndTime} />
                </div>
              </div>
            )}
          </div>

          {/* Weight + duration */}
          <div className="p-4 border border-border rounded-lg space-y-4">
            <h3 className="font-medium text-sm">Rotation</h3>
            <div className="space-y-1">
              <Label className="text-xs">
                Weight (default {templateConfig.defaultWeight})
              </Label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="flex-1 accent-rust"
                />
                <span className="text-sm font-mono w-8 text-right">{weight}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Duration override (sec) — empty inherits {templateConfig.defaultDurationSec}s
              </Label>
              <Input
                type="number"
                min="5"
                max="120"
                value={durationOverride}
                onChange={(e) => setDurationOverride(e.target.value)}
                placeholder={`${templateConfig.defaultDurationSec}`}
              />
            </div>
          </div>

          {/* Per-display targeting */}
          {displays.length > 0 && (
            <div className="p-4 border border-border rounded-lg space-y-3">
              <h3 className="font-medium text-sm">Displays</h3>
              <p className="text-xs text-muted-foreground">
                Leave all unchecked to show on every display.
              </p>
              <div className="space-y-2">
                {displays.map((d) => {
                  const checked = targetDisplays.includes(d.id);
                  return (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setTargetDisplays((prev) =>
                            checked ? prev.filter((id) => id !== d.id) : [...prev, d.id],
                          );
                        }}
                        className="accent-rust w-4 h-4"
                      />
                      <span className="text-sm">{d.name}</span>
                    </label>
                  );
                })}
              </div>
              {targetDisplays.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTargetDisplays([])}
                  className="text-xs text-rust underline"
                >
                  Clear (show on all displays)
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Template-specific content forms ─────────────────────────────────────────

interface TemplateFieldsProps {
  templateType: TemplateKey;
  content: SlideContent;
  onChange: (c: SlideContent) => void;
  bgImageUrl: string | null;
  onBgImageChange: (url: string | null) => void;
  bgVideoUrl: string | null;
  onBgVideoChange: (url: string | null) => void;
  phoneMockupUrl: string | null;
  onPhoneMockupChange: (url: string | null) => void;
  slideLogoUrl: string | null;
  onSlideLogoChange: (url: string | null) => void;
}

function TemplateFields({
  templateType,
  content,
  onChange,
  bgImageUrl,
  onBgImageChange,
  bgVideoUrl,
  onBgVideoChange,
  phoneMockupUrl,
  onPhoneMockupChange,
  slideLogoUrl,
  onSlideLogoChange,
}: TemplateFieldsProps) {
  function set(key: string, value: unknown) {
    onChange({ ...content, [key]: value } as SlideContent);
  }

  switch (templateType) {
    case 'parish_identity': {
      const c = content as Extract<SlideContent, { templateType: 'parish_identity' }>;
      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Headline</Label>
            <Input value={c.headline} onChange={(e) => set('headline', e.target.value)} placeholder="Saint Helen Parish" />
          </div>
          <SizeButtons
            label="Headline size"
            value={c.headlineSize}
            onChange={(v: SizePreset) => set('headlineSize', v)}
          />
          <div className="space-y-1">
            <Label>Subline (optional)</Label>
            <RichTextEditor
              value={c.subline ?? ''}
              onChange={(html) => set('subline', html)}
              placeholder="A Community of Faith"
              toolbar="none"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Press Enter for a new line. Shift+Enter for a soft break.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Logo uses the tenant default from Settings unless overridden here.
          </p>
          <ImageUpload
            label="Slide-specific logo (optional)"
            type="logo"
            currentUrl={slideLogoUrl}
            onUploaded={({ id, blobUrl }) => {
              set('logoMediaId', id);
              onSlideLogoChange(blobUrl);
            }}
            onCleared={() => {
              set('logoMediaId', undefined);
              onSlideLogoChange(null);
            }}
          />
          <PercentageSlider
            label="Logo size"
            value={resolveLogoPercent(c.logoSize)}
            onChange={(v) => set('logoSize', v)}
          />

          {/* Background media */}
          <div className="pt-4 border-t border-border space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Background</p>
            <p className="text-xs text-muted-foreground">
              Optional. Video takes precedence if both are set. Falls back to the animated
              navy gradient when no media is uploaded.
            </p>
            <ImageUpload
              label="Background image"
              type="image"
              currentUrl={bgImageUrl}
              onUploaded={({ id, blobUrl }) => {
                set('bgImageMediaId', id);
                onBgImageChange(blobUrl);
              }}
              onCleared={() => {
                set('bgImageMediaId', undefined);
                onBgImageChange(null);
              }}
            />
            <VideoUpload
              label="Background video (loops, muted)"
              currentUrl={bgVideoUrl}
              onUploaded={({ id, blobUrl }) => {
                set('bgVideoMediaId', id);
                onBgVideoChange(blobUrl);
              }}
              onCleared={() => {
                set('bgVideoMediaId', undefined);
                onBgVideoChange(null);
              }}
            />
          </div>
        </div>
      );
    }

    case 'welcome_quote': {
      const c = content as Extract<SlideContent, { templateType: 'welcome_quote' }>;
      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Quote</Label>
            <Textarea rows={4} value={c.quote} onChange={(e) => set('quote', e.target.value)} placeholder="Come to me, all you who are weary…" />
          </div>
          <SizeButtons
            label="Quote size"
            value={c.quoteSize}
            onChange={(v: SizePreset) => set('quoteSize', v)}
          />
          <div className="space-y-1">
            <Label>Attribution (optional)</Label>
            <Input value={c.attribution ?? ''} onChange={(e) => set('attribution', e.target.value)} placeholder="Matthew 11:28" />
          </div>
        </div>
      );
    }

    case 'general': {
      const c = content as Extract<SlideContent, { templateType: 'general' }>;
      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Headline</Label>
            <Input value={c.headline} onChange={(e) => set('headline', e.target.value)} placeholder="Event or announcement title" />
          </div>
          <SizeButtons
            label="Headline size"
            value={c.headlineSize}
            onChange={(v: SizePreset) => set('headlineSize', v)}
          />
          <div className="space-y-1">
            <Label>Meta line (date, time, location — appears between headline and body)</Label>
            <Input value={c.meta ?? ''} onChange={(e) => set('meta', e.target.value)} placeholder="Sunday, October 12 at 7 PM in Meaney Hall" />
          </div>
          <div className="space-y-1">
            <Label>Body</Label>
            <RichTextEditor
              value={c.body}
              onChange={(html) => set('body', html)}
              placeholder="Description of the event or announcement"
              toolbar="full"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Bold, italic, and bullet lists supported. Press Enter for paragraphs, Shift+Enter for line breaks.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Headline animation</Label>
            <select
              value={c.motionStyle ?? 'lineMask'}
              onChange={(e) => set('motionStyle', e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="lineMask">Line mask (curtain reveal)</option>
              <option value="splitReveal">Split reveal (dramatic)</option>
            </select>
          </div>
          <ImageUpload
            label="Background image (optional)"
            type="image"
            currentUrl={bgImageUrl}
            onUploaded={({ id, blobUrl }) => {
              set('bgImageMediaId', id);
              onBgImageChange(blobUrl);
            }}
            onCleared={() => {
              set('bgImageMediaId', undefined);
              onBgImageChange(null);
            }}
          />
        </div>
      );
    }

    case 'mass_schedule': {
      const c = content as Extract<SlideContent, { templateType: 'mass_schedule' }>;
      // Normalize legacy single-section data into the dual-section editor view
      const initialWeekendRows: MassScheduleRow[] =
        c.weekendRows ?? (c.scheduleKind === 'weekend' ? (c.rows ?? []) : []);
      const initialWeekdayRows: MassScheduleRow[] =
        c.weekdayRows ?? (c.scheduleKind === 'weekday' ? (c.rows ?? []) : []);

      return (
        <div className="space-y-6">
          <div className="space-y-1">
            <Label>Weekend dates label (optional)</Label>
            <Input
              value={c.weekendLabel ?? ''}
              onChange={(e) => set('weekendLabel', e.target.value)}
              placeholder="e.g. Weekend of May 16 / 17"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to show &ldquo;This Weekend&rsquo;s Masses&rdquo;.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs uppercase tracking-widest text-muted-foreground pt-2">
              Weekend Masses
            </p>
            <PasteParser
              templateType="mass_schedule_weekend"
              savedRows={initialWeekendRows.map((r) => ({ ...r, needsReview: false }))}
              onParsed={(rows) =>
                set(
                  'weekendRows',
                  rows.map(({ needsReview: _ignored, ...r }) => r) as MassScheduleRow[],
                )
              }
            />
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <p className="text-xs uppercase tracking-widest text-muted-foreground pt-2">
              Daily Mass Intentions
            </p>
            <PasteParser
              templateType="mass_schedule_weekday"
              savedRows={initialWeekdayRows.map((r) => ({ ...r, needsReview: false }))}
              onParsed={(rows) =>
                set(
                  'weekdayRows',
                  rows.map(({ needsReview: _ignored, ...r }) => r) as MassScheduleRow[],
                )
              }
            />
          </div>
        </div>
      );
    }

    case 'weekly_association': {
      const c = content as Extract<SlideContent, { templateType: 'weekly_association' }>;
      return (
        <PasteParser
          templateType="weekly_association"
          savedRows={c.names.map((name) => ({ name, needsReview: false }))}
          onParsed={(rows) => set('names', (rows as { name: string }[]).map((r) => r.name))}
        />
      );
    }

    case 'sanctuary_candle': {
      const c = content as Extract<SlideContent, { templateType: 'sanctuary_candle' }>;
      return (
        <div className="space-y-4">
          <PasteParser
            templateType="sanctuary_candle"
            savedRows={c.name ? [{ name: c.name, needsReview: false }] : []}
            onParsed={(rows) => {
              const first = (rows as { name: string }[])[0];
              if (first) set('name', first.name);
            }}
          />
          <SizeButtons
            label="Name size"
            value={c.nameSize}
            onChange={(v: SizePreset) => set('nameSize', v)}
          />
          <div className="flex items-center gap-3">
            <Switch
              checked={c.inMemoryOf ?? true}
              onCheckedChange={(v) => set('inMemoryOf', v)}
            />
            <Label>{c.inMemoryOf ? 'In Memory Of' : 'In Honor Of'}</Label>
          </div>
        </div>
      );
    }

    case 'app_promo': {
      const c = content as Extract<SlideContent, { templateType: 'app_promo' }>;
      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Headline</Label>
            <Input value={c.headline} onChange={(e) => set('headline', e.target.value)} />
          </div>
          <SizeButtons
            label="Headline size"
            value={c.headlineSize}
            onChange={(v: SizePreset) => set('headlineSize', v)}
          />
          <div className="space-y-1">
            <Label>Body</Label>
            <Textarea rows={3} value={c.body} onChange={(e) => set('body', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>URL</Label>
            <Input value={c.url} onChange={(e) => set('url', e.target.value)} placeholder="sainthelen.org/app" />
          </div>
          <ImageUpload
            label="Phone mockup image (optional)"
            type="image"
            currentUrl={phoneMockupUrl}
            onUploaded={({ id, blobUrl }) => {
              set('phoneMockupMediaId', id);
              onPhoneMockupChange(blobUrl);
            }}
            onCleared={() => {
              set('phoneMockupMediaId', undefined);
              onPhoneMockupChange(null);
            }}
          />
        </div>
      );
    }
  }
}
