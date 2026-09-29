'use client';

import { useState } from 'react';
import { useHotkey } from '@/lib/useHotkey';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RectangleVertical, RectangleHorizontal, Plus, X } from 'lucide-react';
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
import { StyleSection } from './StyleSection';
import { PercentageSlider } from './PercentageSlider';
import { RichTextEditor } from './RichTextEditor';
import { resolveLogoPercent } from '@/components/templates/sizing';
import { templates } from '@/components/templates';
import type { TemplateKey } from '@/components/templates';
import { CollectionPicker } from './CollectionPicker';
import type { SlideWithContent, SlideContent, MassScheduleRow, TextMode, Collection, SlideOrientation } from '@/lib/db/schema';
import { dateToTimeValue, type TimeValue } from '@/lib/time';

type OrientationMedia = {
  logoUrl?: string | null;
  bgImageUrl?: string | null;
  bgVideoUrl?: string | null;
  phoneMockupUrl?: string | null;
  imageUrl?: string | null;
};

interface SlideEditorProps {
  templateType: TemplateKey;
  initialSlide: SlideWithContent | null;
  tenantLogoUrl?: string | null;
  displays?: { id: string; name: string }[];
  collections?: Collection[];
  initialMedia?: {
    portrait?: OrientationMedia;
    landscape?: OrientationMedia;
  };
}

/**
 * Build a local-time Date from a YYYY-MM-DD string and a 12-hour TimeValue.
 * `new Date('2026-10-12')` would parse as UTC midnight, which is the
 * previous evening in the US — so we construct from parts instead.
 */
function joinLocal(date: string, time: TimeValue): Date {
  const [y, m, d] = date.split('-').map((p) => parseInt(p, 10));
  let h = time.hour % 12;
  if (time.period === 'PM') h += 12;
  return new Date(y, (m || 1) - 1, d || 1, h, time.minute, 0, 0);
}

/** Inverse of joinLocal: an instant → local date string + TimeValue. */
function splitLocal(value: Date | string | null): { date: string; time: TimeValue } | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // dateToTimeValue rounds to the picker's 5-minute steps.
  return { date, time: dateToTimeValue(d) };
}

function isContentEmpty(c: unknown): boolean {
  return !c || typeof c !== 'object' || Object.keys(c as Record<string, unknown>).length === 0;
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
    case 'poster':
      return { templateType, fit: 'contain', caption: '' };
  }
}

/** YYYY-MM-DD → the next day, same format (local parts, no UTC drift). */
function dayAfter(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  const next = new Date(y, m - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

export function SlideEditor({
  templateType,
  initialSlide,
  tenantLogoUrl,
  displays = [],
  collections: initialCollections = [],
  initialMedia,
}: SlideEditorProps) {
  const router = useRouter();
  const isNew = !initialSlide;

  const [title, setTitle] = useState(initialSlide?.title ?? '');
  const [collections, setCollections] = useState<Collection[]>(initialCollections);
  const [collectionId, setCollectionId] = useState<string | null>(
    initialSlide?.collectionId ?? null,
  );

  // Per-orientation content. New slides start with template defaults in the
  // portrait slot and an empty landscape slot. Existing slides pick up
  // their authored content; empty content slots fall back to defaults so
  // the editor never starts with literally blank fields.
  const initialPortraitContent: SlideContent = !isContentEmpty(initialSlide?.content)
    ? (initialSlide!.content as SlideContent)
    : defaultContent(templateType);
  const initialPortraitHas = isNew ? true : !isContentEmpty(initialSlide?.content);
  const initialLandscapeHas = !isContentEmpty(initialSlide?.contentLandscape);

  // We store the most recent edits per orientation even when the user
  // "removes" that orientation — flipping the `has` flag back on restores
  // the previous content without losing keystrokes. The persisted content
  // sent on save is only the orientations whose `has` flag is true.
  const [portraitContent, setPortraitContent] = useState<SlideContent>(initialPortraitContent);
  const [landscapeContent, setLandscapeContent] = useState<SlideContent>(
    !isContentEmpty(initialSlide?.contentLandscape)
      ? (initialSlide!.contentLandscape as SlideContent)
      : defaultContent(templateType),
  );
  const [portraitHas, setPortraitHas] = useState(initialPortraitHas);
  const [landscapeHas, setLandscapeHas] = useState(initialLandscapeHas);
  // Active tab. Default to portrait if it has content; otherwise landscape.
  const [activeOrientation, setActiveOrientation] = useState<SlideOrientation>(
    initialPortraitHas ? 'portrait' : initialLandscapeHas ? 'landscape' : 'portrait',
  );

  const [scheduleType, setScheduleType] = useState<'evergreen' | 'dated'>(
    initialSlide?.scheduleType ?? 'evergreen',
  );
  // Dates are edited in the browser's local time and stored as instants.
  // Split the saved instant into a local YYYY-MM-DD + TimeValue (the old
  // code used toISOString(), which is UTC — every save in a US timezone
  // moved the date one day earlier).
  const initialStart = splitLocal(initialSlide?.startAt ?? null);
  const initialEnd = splitLocal(initialSlide?.endAt ?? null);
  const [startDate, setStartDate] = useState(initialStart?.date ?? '');
  const [startTime, setStartTime] = useState<TimeValue>(
    initialStart?.time ?? { hour: 12, minute: 0, period: 'AM' },
  );
  const [endDate, setEndDate] = useState(initialEnd?.date ?? '');
  const [endTime, setEndTime] = useState<TimeValue>(
    initialEnd?.time ?? { hour: 11, minute: 59, period: 'PM' },
  );
  const [weight, setWeight] = useState(String(initialSlide?.weight ?? 1));
  const [durationOverride, setDurationOverride] = useState(
    initialSlide?.durationOverrideSec ? String(initialSlide.durationOverrideSec) : '',
  );
  const [active, setActive] = useState(initialSlide?.active ?? true);
  const [priority, setPriority] = useState(initialSlide?.priority ?? false);
  const [targetDisplays, setTargetDisplays] = useState<string[]>(
    (initialSlide?.targetDisplays as string[]) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [savedState, setSavedState] = useState<'idle' | 'saved' | 'error'>('idle');
  // Track resolved media URLs for live preview, per orientation. Not
  // persisted — looked up server-side from IDs stored inside the content
  // jsonb. Each orientation has its own media slots so the user can pick
  // (e.g.) a portrait bg image and a different landscape bg image.
  const [portraitMedia, setPortraitMedia] = useState<OrientationMedia>({
    logoUrl: initialMedia?.portrait?.logoUrl ?? null,
    bgImageUrl: initialMedia?.portrait?.bgImageUrl ?? null,
    bgVideoUrl: initialMedia?.portrait?.bgVideoUrl ?? null,
    phoneMockupUrl: initialMedia?.portrait?.phoneMockupUrl ?? null,
    imageUrl: initialMedia?.portrait?.imageUrl ?? null,
  });
  const [landscapeMedia, setLandscapeMedia] = useState<OrientationMedia>({
    logoUrl: initialMedia?.landscape?.logoUrl ?? null,
    bgImageUrl: initialMedia?.landscape?.bgImageUrl ?? null,
    bgVideoUrl: initialMedia?.landscape?.bgVideoUrl ?? null,
    phoneMockupUrl: initialMedia?.landscape?.phoneMockupUrl ?? null,
    imageUrl: initialMedia?.landscape?.imageUrl ?? null,
  });

  // Active-tab proxies — let the form below read/write a single content
  // blob without caring which orientation is in front.
  const activeContent = activeOrientation === 'portrait' ? portraitContent : landscapeContent;
  const setActiveContent = (c: SlideContent) => {
    if (activeOrientation === 'portrait') setPortraitContent(c);
    else setLandscapeContent(c);
  };
  const activeMedia = activeOrientation === 'portrait' ? portraitMedia : landscapeMedia;
  const updateActiveMedia = (patch: Partial<OrientationMedia>) => {
    if (activeOrientation === 'portrait') setPortraitMedia((m) => ({ ...m, ...patch }));
    else setLandscapeMedia((m) => ({ ...m, ...patch }));
  };

  const templateConfig = templates[templateType];

  function buildBody() {
    const body: Record<string, unknown> = {
      title,
      templateType,
      content: portraitHas ? portraitContent : {},
      contentLandscape: landscapeHas ? landscapeContent : null,
      scheduleType,
      active,
      priority,
      weight: parseFloat(weight) || 1,
      durationOverrideSec: durationOverride ? parseInt(durationOverride) : null,
      targetDisplays,
      collectionId,
    };

    if (scheduleType === 'dated') {
      body.startAt = startDate ? joinLocal(startDate, startTime).toISOString() : null;
      body.endAt = endDate ? joinLocal(endDate, endTime).toISOString() : null;
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
    if (!portraitHas && !landscapeHas) {
      toast.error('Add at least one orientation (vertical or horizontal)');
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

  // ⌘S / Ctrl+S to save from anywhere in the editor (including fields).
  useHotkey('mod+s', (e) => {
    e.preventDefault();
    if (!saving) handleSave();
  });

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

          {/* Orientation tabs — switch which orientation's content the form edits. */}
          <OrientationTabs
            active={activeOrientation}
            onChange={setActiveOrientation}
            portraitHas={portraitHas}
            landscapeHas={landscapeHas}
            onAddPortrait={() => {
              setPortraitContent((c) => (isContentEmpty(c) ? defaultContent(templateType) : c));
              setPortraitHas(true);
              setActiveOrientation('portrait');
            }}
            onAddLandscape={() => {
              setLandscapeContent((c) => (isContentEmpty(c) ? defaultContent(templateType) : c));
              setLandscapeHas(true);
              setActiveOrientation('landscape');
            }}
            onRemovePortrait={() => {
              if (!landscapeHas) {
                toast.error('Add a horizontal version first');
                return;
              }
              setPortraitHas(false);
              setActiveOrientation('landscape');
            }}
            onRemoveLandscape={() => {
              if (!portraitHas) {
                toast.error('Add a vertical version first');
                return;
              }
              setLandscapeHas(false);
              setActiveOrientation('portrait');
            }}
            onCopyToPortrait={() => {
              setPortraitContent(landscapeContent);
              setPortraitMedia(landscapeMedia);
              setPortraitHas(true);
              setActiveOrientation('portrait');
            }}
            onCopyToLandscape={() => {
              setLandscapeContent(portraitContent);
              setLandscapeMedia(portraitMedia);
              setLandscapeHas(true);
              setActiveOrientation('landscape');
            }}
          />

          {/* Template-specific fields — bound to the active orientation. */}
          {(activeOrientation === 'portrait' ? portraitHas : landscapeHas) ? (
            <TemplateFields
              templateType={templateType}
              content={activeContent}
              onChange={setActiveContent}
              bgImageUrl={activeMedia.bgImageUrl ?? null}
              onBgImageChange={(url) => updateActiveMedia({ bgImageUrl: url })}
              bgVideoUrl={activeMedia.bgVideoUrl ?? null}
              onBgVideoChange={(url) => updateActiveMedia({ bgVideoUrl: url })}
              phoneMockupUrl={activeMedia.phoneMockupUrl ?? null}
              onPhoneMockupChange={(url) => updateActiveMedia({ phoneMockupUrl: url })}
              slideLogoUrl={activeMedia.logoUrl ?? null}
              onSlideLogoChange={(url) => updateActiveMedia({ logoUrl: url })}
              imageUrl={activeMedia.imageUrl ?? null}
              onImageChange={(url) => updateActiveMedia({ imageUrl: url })}
              onExpireAfter={(ymd) => {
                setScheduleType('dated');
                setEndDate(dayAfter(ymd));
                setEndTime({ hour: 6, minute: 0, period: 'AM' });
                toast.success(`Will turn off the morning after ${ymd}`);
              }}
              scheduleEndDate={scheduleType === 'dated' ? endDate : ''}
            />
          ) : (
            <EmptyOrientationCallout
              orientation={activeOrientation}
              otherAuthored={activeOrientation === 'portrait' ? landscapeHas : portraitHas}
              onStartBlank={() => {
                if (activeOrientation === 'portrait') {
                  setPortraitContent(defaultContent(templateType));
                  setPortraitHas(true);
                } else {
                  setLandscapeContent(defaultContent(templateType));
                  setLandscapeHas(true);
                }
              }}
              onCopyFromOther={() => {
                if (activeOrientation === 'portrait') {
                  setPortraitContent(landscapeContent);
                  setPortraitMedia(landscapeMedia);
                  setPortraitHas(true);
                } else {
                  setLandscapeContent(portraitContent);
                  setLandscapeMedia(portraitMedia);
                  setLandscapeHas(true);
                }
              }}
            />
          )}
        </div>

        {/* Right: Schedule + settings (40%) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live preview — shows whichever orientation is active. */}
          <div className="p-4 border border-border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">
                Preview ·{' '}
                <span className="text-muted-foreground">
                  {activeOrientation === 'portrait' ? 'Vertical' : 'Horizontal'}
                </span>
              </h3>
              {!isNew && initialSlide && (
                <a
                  href={`/display/__preview?slideId=${initialSlide.id}&orientation=${activeOrientation}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-navy underline"
                >
                  Full size ↗
                </a>
              )}
            </div>
            {(activeOrientation === 'portrait' ? portraitHas : landscapeHas) ? (
              <LivePreview
                templateType={templateType}
                content={activeContent}
                orientation={activeOrientation}
                logoUrl={activeMedia.logoUrl ?? tenantLogoUrl ?? null}
                bgImageUrl={activeMedia.bgImageUrl ?? null}
                bgVideoUrl={activeMedia.bgVideoUrl ?? null}
                phoneMockupUrl={activeMedia.phoneMockupUrl ?? null}
                imageUrl={activeMedia.imageUrl ?? null}
                width={activeOrientation === 'portrait' ? 280 : 380}
              />
            ) : (
              <div className="text-xs text-muted-foreground italic py-8 text-center border border-dashed border-border rounded-md">
                No {activeOrientation === 'portrait' ? 'vertical' : 'horizontal'} version yet.
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-2">
              Live preview. Animations replay 500ms after you stop typing.
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
                <Label>Show on TVs as soon as I save</Label>
              </div>
            </div>
          )}

          {/* Takeover */}
          <div className={`p-4 border rounded-lg space-y-2 ${priority ? 'border-rust bg-rust/5' : 'border-border'}`}>
            <div className="flex items-center gap-3">
              <Switch checked={priority} onCheckedChange={setPriority} />
              <Label className={priority ? 'text-rust font-semibold' : ''}>Takeover</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              While this slide is on (and within its dates), the TVs show only takeover
              slides — nothing else. For a funeral notice, a weather closure, an emergency
              message. Turn it off to resume the normal rotation.
            </p>
          </div>

          {/* Schedule type */}
          <div className="p-4 border border-border rounded-lg space-y-4">
            <h3 className="font-medium text-sm">When to show this</h3>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleType"
                  value="evergreen"
                  checked={scheduleType === 'evergreen'}
                  onChange={() => setScheduleType('evergreen')}
                  className="accent-rust"
                />
                <span className="text-sm">Always (until I turn it off)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleType"
                  value="dated"
                  checked={scheduleType === 'dated'}
                  onChange={() => setScheduleType('dated')}
                  className="accent-rust"
                />
                <span className="text-sm">Only between certain dates</span>
              </label>
            </div>

            {scheduleType === 'dated' && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Leave Start blank to start right now. Leave End blank to keep running until you turn it off.
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
            <h3 className="font-medium text-sm">How often & how long</h3>
            <div className="space-y-1">
              <Label className="text-xs">
                How often to show (1 = normal, 2 = twice as often, 0 = off)
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
                Time on screen (seconds) — leave blank to use the default of {templateConfig.defaultDurationSec}s
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

          {/* Collection assignment — bundle slides into seasonal/editorial packs */}
          <div className="p-4 border border-border rounded-lg space-y-3">
            <h3 className="font-medium text-sm">Collection</h3>
            <CollectionPicker
              collections={collections}
              value={collectionId}
              onChange={setCollectionId}
              onCollectionCreated={(c) => setCollections((prev) => [...prev, c])}
            />
          </div>

          {/* Per-display targeting */}
          {displays.length > 0 && (
            <div className="p-4 border border-border rounded-lg space-y-3">
              <h3 className="font-medium text-sm">Which TVs</h3>
              <p className="text-xs text-muted-foreground">
                Leave everything unchecked to show on every TV.
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
                  Show on every TV instead
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─── Orientation tabs ────────────────────────────────────────────────────────

interface OrientationTabsProps {
  active: SlideOrientation;
  onChange: (o: SlideOrientation) => void;
  portraitHas: boolean;
  landscapeHas: boolean;
  onAddPortrait: () => void;
  onAddLandscape: () => void;
  onRemovePortrait: () => void;
  onRemoveLandscape: () => void;
  onCopyToPortrait: () => void;
  onCopyToLandscape: () => void;
}

function OrientationTabs({
  active,
  onChange,
  portraitHas,
  landscapeHas,
  onRemovePortrait,
  onRemoveLandscape,
}: OrientationTabsProps) {
  function Tab({
    orientation,
    label,
    icon,
    authored,
  }: {
    orientation: SlideOrientation;
    label: string;
    icon: React.ReactNode;
    authored: boolean;
  }) {
    const isActive = orientation === active;
    return (
      <button
        type="button"
        onClick={() => onChange(orientation)}
        className={`flex items-center gap-2 px-3 py-2 border-b-2 -mb-px text-sm font-medium transition-colors ${
          isActive
            ? 'border-rust text-navy'
            : 'border-transparent text-navy/55 hover:text-navy hover:border-navy/20'
        }`}
      >
        {icon}
        <span>{label}</span>
        <span
          className={`text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded ${
            authored ? 'bg-navy/10 text-navy/70' : 'bg-navy/5 text-navy/40'
          }`}
        >
          {authored ? 'Authored' : 'Empty'}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-end justify-between border-b border-border">
      <div className="flex items-end gap-2">
        <Tab
          orientation="portrait"
          label="Vertical"
          icon={<RectangleVertical size={14} />}
          authored={portraitHas}
        />
        <Tab
          orientation="landscape"
          label="Horizontal"
          icon={<RectangleHorizontal size={14} />}
          authored={landscapeHas}
        />
      </div>
      {/* Remove action — only when the active tab is authored AND the
          other side is too (so we never strand a slide with no orientations). */}
      {((active === 'portrait' && portraitHas && landscapeHas) ||
        (active === 'landscape' && landscapeHas && portraitHas)) && (
        <button
          type="button"
          onClick={active === 'portrait' ? onRemovePortrait : onRemoveLandscape}
          className="mb-1 flex items-center gap-1 text-xs text-navy/55 hover:text-rust"
        >
          <X size={12} />
          Remove {active === 'portrait' ? 'vertical' : 'horizontal'} version
        </button>
      )}
    </div>
  );
}

function EmptyOrientationCallout({
  orientation,
  otherAuthored,
  onStartBlank,
  onCopyFromOther,
}: {
  orientation: SlideOrientation;
  otherAuthored: boolean;
  onStartBlank: () => void;
  onCopyFromOther: () => void;
}) {
  const label = orientation === 'portrait' ? 'vertical' : 'horizontal';
  const otherLabel = orientation === 'portrait' ? 'horizontal' : 'vertical';
  return (
    <div className="border border-dashed border-border rounded-lg p-6 text-center space-y-3">
      <p className="text-sm text-navy/65">
        This slide has no {label} version yet. It won&apos;t appear on{' '}
        {label} screens until you add one.
      </p>
      <div className="flex justify-center gap-2 flex-wrap">
        <Button
          type="button"
          onClick={onStartBlank}
          className="bg-rust text-cream hover:bg-rust-700 gap-1.5"
        >
          <Plus size={14} />
          Start a {label} version
        </Button>
        {otherAuthored && (
          <Button
            type="button"
            variant="outline"
            onClick={onCopyFromOther}
            className="gap-1.5"
          >
            Copy from {otherLabel}
          </Button>
        )}
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
  imageUrl: string | null;
  onImageChange: (url: string | null) => void;
  /** Sets the schedule to end the morning after the given YYYY-MM-DD. */
  onExpireAfter: (ymd: string) => void;
  /** Current end date when the schedule is dated (for the helper's label). */
  scheduleEndDate: string;
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
  imageUrl,
  onImageChange,
  onExpireAfter,
  scheduleEndDate,
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
          <div className="space-y-1">
            <Label>Tagline (optional)</Label>
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
            Uses the parish logo from Settings unless you set one here.
          </p>
          <ImageUpload
            label="Use a different logo on this slide (optional)"
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
              label="Background video (plays silently on a loop)"
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
          <div className="space-y-1">
            <Label>Attribution (optional)</Label>
            <Input value={c.attribution ?? ''} onChange={(e) => set('attribution', e.target.value)} placeholder="Matthew 11:28" />
          </div>
          <StyleSection
            bgImageUrl={bgImageUrl}
            onBgImageUploaded={(id, blobUrl) => {
              set('bgImageMediaId', id);
              onBgImageChange(blobUrl);
            }}
            onBgImageCleared={() => {
              set('bgImageMediaId', undefined);
              onBgImageChange(null);
            }}
            textMode={c.textMode}
            defaultTextMode="dark"
            onTextModeChange={(m: TextMode) => set('textMode', m)}
          />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Event date</Label>
              <Input
                type="date"
                value={c.eventDate ?? ''}
                onChange={(e) => set('eventDate', e.target.value || undefined)}
              />
              {c.eventDate ? (
                <button
                  type="button"
                  onClick={() => onExpireAfter(c.eventDate!)}
                  className="text-xs text-rust hover:underline"
                >
                  {scheduleEndDate === dayAfter(c.eventDate)
                    ? 'Turns off the morning after ✓'
                    : 'Turn off the morning after the event'}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground">Optional. Lets the slide expire itself.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Date, time &amp; location line</Label>
              <Input value={c.meta ?? ''} onChange={(e) => set('meta', e.target.value)} placeholder="Sunday, October 12 at 7 PM in Meaney Hall" />
              <p className="text-xs text-muted-foreground">
                Leave blank to show the event date as “Sunday, October 12”.
              </p>
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Sign-up link (shown as a QR code)</Label>
              <Input value={c.qrUrl ?? ''} onChange={(e) => set('qrUrl', e.target.value)} placeholder="sainthelen.org/lifelines" />
            </div>
            <div className="space-y-1">
              <Label>QR caption</Label>
              <Input value={c.qrLabel ?? ''} onChange={(e) => set('qrLabel', e.target.value)} placeholder="Scan to sign up" />
            </div>
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
          <StyleSection
            bgImageUrl={bgImageUrl}
            onBgImageUploaded={(id, blobUrl) => {
              set('bgImageMediaId', id);
              onBgImageChange(blobUrl);
            }}
            onBgImageCleared={() => {
              set('bgImageMediaId', undefined);
              onBgImageChange(null);
            }}
            textMode={c.textMode}
            defaultTextMode="dark"
            onTextModeChange={(m: TextMode) => set('textMode', m)}
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

          <StyleSection
            bgImageUrl={bgImageUrl}
            onBgImageUploaded={(id, blobUrl) => {
              set('bgImageMediaId', id);
              onBgImageChange(blobUrl);
            }}
            onBgImageCleared={() => {
              set('bgImageMediaId', undefined);
              onBgImageChange(null);
            }}
            textMode={c.textMode}
            defaultTextMode="dark"
            onTextModeChange={(m: TextMode) => set('textMode', m)}
          />
        </div>
      );
    }

    case 'weekly_association': {
      const c = content as Extract<SlideContent, { templateType: 'weekly_association' }>;
      return (
        <div className="space-y-6">
          <PasteParser
            templateType="weekly_association"
            savedRows={c.names.map((name) => ({ name, needsReview: false }))}
            onParsed={(rows) => set('names', (rows as { name: string }[]).map((r) => r.name))}
          />
          <StyleSection
            bgImageUrl={bgImageUrl}
            onBgImageUploaded={(id, blobUrl) => {
              set('bgImageMediaId', id);
              onBgImageChange(blobUrl);
            }}
            onBgImageCleared={() => {
              set('bgImageMediaId', undefined);
              onBgImageChange(null);
            }}
            textMode={c.textMode}
            defaultTextMode="dark"
            onTextModeChange={(m: TextMode) => set('textMode', m)}
          />
        </div>
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
          <div className="flex items-center gap-3">
            <Switch
              checked={c.inMemoryOf ?? true}
              onCheckedChange={(v) => set('inMemoryOf', v)}
            />
            <Label>{c.inMemoryOf ? 'In Memory Of' : 'In Honor Of'}</Label>
          </div>
          <StyleSection
            bgImageUrl={bgImageUrl}
            onBgImageUploaded={(id, blobUrl) => {
              set('bgImageMediaId', id);
              onBgImageChange(blobUrl);
            }}
            onBgImageCleared={() => {
              set('bgImageMediaId', undefined);
              onBgImageChange(null);
            }}
          />
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
          <StyleSection
            bgImageUrl={bgImageUrl}
            onBgImageUploaded={(id, blobUrl) => {
              set('bgImageMediaId', id);
              onBgImageChange(blobUrl);
            }}
            onBgImageCleared={() => {
              set('bgImageMediaId', undefined);
              onBgImageChange(null);
            }}
          />
        </div>
      );
    }

    case 'poster': {
      const c = content as Extract<SlideContent, { templateType: 'poster' }>;
      return (
        <div className="space-y-4">
          <ImageUpload
            label="Flyer image (PNG or JPG, portrait works best)"
            type="image"
            currentUrl={imageUrl}
            onUploaded={({ id, blobUrl }) => {
              set('imageMediaId', id);
              onImageChange(blobUrl);
            }}
            onCleared={() => {
              set('imageMediaId', undefined);
              onImageChange(null);
            }}
          />
          <div className="space-y-1">
            <Label>How to fit the screen</Label>
            <select
              value={c.fit ?? 'contain'}
              onChange={(e) => set('fit', e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="contain">Show the whole flyer (blurred edges fill the gaps)</option>
              <option value="cover">Fill the screen (crops the edges)</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Caption (optional)</Label>
            <Input value={c.caption ?? ''} onChange={(e) => set('caption', e.target.value)} placeholder="Saturday, October 18 · Meaney Hall" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Sign-up link (shown as a QR code)</Label>
              <Input value={c.qrUrl ?? ''} onChange={(e) => set('qrUrl', e.target.value)} placeholder="sainthelen.org/fest" />
            </div>
            <div className="space-y-1">
              <Label>QR caption</Label>
              <Input value={c.qrLabel ?? ''} onChange={(e) => set('qrLabel', e.target.value)} placeholder="Scan to sign up" />
            </div>
          </div>
        </div>
      );
    }
  }
}
