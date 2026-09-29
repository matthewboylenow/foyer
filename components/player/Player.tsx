'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getImageProps } from 'next/image';
import { SlideFrame } from './SlideFrame';
import { SlideErrorBoundary } from './SlideErrorBoundary';
import { BgVideoStack } from './BgVideoStack';
import { buildShuffledPool, slidesHaveChanged } from './shuffle';
import { templates } from '@/components/templates';
import { reportError } from '@/lib/reportError';
import type { SlideOrientation } from '@/lib/db/schema';

type PlayerSlide = {
  id: string;
  tenantId: string;
  templateType: keyof typeof templates;
  title: string;
  content: Record<string, unknown>;
  scheduleType: 'evergreen' | 'dated';
  startAt: string | Date | null;
  endAt: string | Date | null;
  targetDisplays: unknown;
  active: boolean;
  weight: number;
  durationOverrideSec: number | null;
  collectionId: string | null;
  displayOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  createdBy: string | null;
  updatedBy: string | null;
  resolvedMedia?: Record<string, string>;
};

type ApiResponse = {
  orientation: SlideOrientation;
  slides: PlayerSlide[];
  /** Playlist fingerprint from the server (see lib/fleet.ts). */
  version?: string | null;
};

// Bumped from v0 (slides[]) to v1 ({ orientation, slides }) — old cache entries
// from before v1.9 won't deserialize correctly, so the new key invalidates them.
const CACHE_KEY_PREFIX = 'lastFetch.v1';
// The heartbeat (every HEARTBEAT_MS) carries the server's playlist version,
// so we only fetch the playlist when it changes. The poll below is a
// safety net for the case where heartbeats fail but GETs succeed; with
// If-None-Match it costs the server one cheap query.
const HEARTBEAT_MS = 60_000;
const POLL_INTERVAL_MS = 15 * 60_000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function loadFromCache(displayId: string): ApiResponse | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}:${displayId}`);
    if (!raw) return null;
    const { data, savedAt } = JSON.parse(raw) as { data: ApiResponse; savedAt: number };
    if (Date.now() - savedAt > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function saveToCache(displayId: string, data: ApiResponse) {
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}:${displayId}`,
      JSON.stringify({ data, savedAt: Date.now() }),
    );
  } catch {
    // localStorage unavailable or full — skip
  }
}

const FALLBACK_SLIDE: PlayerSlide = {
  id: '__fallback__',
  tenantId: '',
  templateType: 'parish_identity',
  title: 'Fallback',
  content: {
    templateType: 'parish_identity',
    headline: 'Saint Helen Parish',
    subline: 'Welcome',
  },
  scheduleType: 'evergreen',
  startAt: null,
  endAt: null,
  targetDisplays: [],
  active: true,
  weight: 1,
  durationOverrideSec: null,
  displayOrder: 0,
  collectionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  updatedBy: null,
};

interface PlayerProps {
  displayId: string;
}

export function Player({ displayId }: PlayerProps) {
  const [orientation, setOrientation] = useState<SlideOrientation>('portrait');
  const [slides, setSlides] = useState<PlayerSlide[]>([]);
  const [pool, setPool] = useState<PlayerSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const queuedSlidesRef = useRef<PlayerSlide[] | null>(null);
  const [ready, setReady] = useState(false);
  // Slides whose templates have thrown during this session — filtered out
  // of the pool on next rebuild so we don't loop on a broken slide.
  const [bannedIds, setBannedIds] = useState<Set<string>>(() => new Set());
  // Last playlist version we loaded (also sent as If-None-Match).
  const versionRef = useRef<string | null>(null);
  // Mirror of `slides` for callbacks that shouldn't re-subscribe on change.
  const slidesRef = useRef<PlayerSlide[]>([]);
  slidesRef.current = slides;

  const banSlide = useCallback((id: string) => {
    setBannedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Global error capture for the player page — anything thrown outside the
  // template boundary (network, framework code, motion-react internals)
  // still gets reported with display context.
  useEffect(() => {
    function onError(e: ErrorEvent) {
      reportError({
        source: 'player',
        message: e.message || 'window.onerror (no message)',
        stack: e.error?.stack,
        displayId,
        context: { filename: e.filename, lineno: e.lineno, colno: e.colno },
      });
    }
    function onRejection(e: PromiseRejectionEvent) {
      const reason = e.reason as unknown;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled promise rejection';
      reportError({
        source: 'player',
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
        displayId,
      });
    }
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [displayId]);

  // Initial load: try API then cache then fallback
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/display/${displayId}`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as ApiResponse;
          if (data?.slides && data.slides.length > 0) {
            saveToCache(displayId, data);
            versionRef.current = data.version ?? null;
            setOrientation(data.orientation);
            setSlides(data.slides);
            setPool(buildShuffledPool(data.slides));
            setReady(true);
            return;
          }
        }
      } catch {
        // network failed
      }

      const cached = loadFromCache(displayId);
      if (cached?.slides && cached.slides.length > 0) {
        versionRef.current = cached.version ?? null;
        setOrientation(cached.orientation);
        setSlides(cached.slides);
        setPool(buildShuffledPool(cached.slides));
      } else {
        setSlides([FALLBACK_SLIDE]);
        setPool([FALLBACK_SLIDE]);
      }
      setReady(true);
    }
    init();
  }, [displayId]);

  // Fetch the playlist and queue any change for the next loop boundary.
  // Sends If-None-Match so an unchanged playlist is a 304 (one cheap query
  // server-side, no body).
  const refetch = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (versionRef.current) headers['If-None-Match'] = `"${versionRef.current}"`;
      const res = await fetch(`/api/display/${displayId}`, { cache: 'no-store', headers });
      if (res.status === 304) return;
      if (!res.ok) return;
      const data = (await res.json()) as ApiResponse;
      if (!data?.slides) return;
      versionRef.current = data.version ?? null;
      // Orientation can change live if the admin flips a display; update
      // immediately so subsequent renders use the new aspect / templates.
      setOrientation((prev) => (data.orientation !== prev ? data.orientation : prev));
      if (slidesHaveChanged(slidesRef.current, data.slides)) {
        queuedSlidesRef.current = data.slides;
        saveToCache(displayId, data);
      }
    } catch {
      // network blip — continue from current data
    }
  }, [displayId]);

  // Safety-net poll. Real change detection happens on the heartbeat reply.
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(refetch, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, refetch]);

  // Pre-decode the next slide's media during the current slide's hold so
  // image decode never blocks the cross-dissolve. Without this, the new
  // template mounts and Image decode hitches the GPU exactly when the
  // transition is supposed to be smooth — the "bloated cut" feeling.
  //
  // Background images must warm the SAME /_next/image URL that KenBurns
  // renders. The old code set img.src to the raw blob URL, which downloaded
  // the full-size original from Blob storage (pure egress) and then the
  // real render fetched the optimized variant anyway — the warm-up never
  // helped and doubled transfer. getImageProps with the same props KenBurns
  // uses yields an identical srcset/sizes pair, so the browser resolves the
  // exact candidate the upcoming <Image> will request.
  //
  // No video prewarm: BgVideoStack mounts every pool video once with
  // preload="auto" and never unmounts it, so the bytes are already
  // resident. The old per-rotation Range fetch couldn't be served from
  // the browser cache reliably (206 responses) and re-streamed the file
  // from Blob on every slide change.
  useEffect(() => {
    if (pool.length === 0) return;
    const next = pool[(currentIndex + 1) % pool.length];

    const warm = (p: { src: string; srcSet?: string; sizes?: string }) => {
      const img = new window.Image();
      if (p.srcSet) img.srcset = p.srcSet;
      if (p.sizes) img.sizes = p.sizes;
      img.src = p.src;
      // Hint to the browser to decode off the main thread when supported.
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {
          // Decode can reject if the resource is replaced — safe to ignore.
        });
      }
    };

    const bgUrl = next?.resolvedMedia?.bgImageUrl;
    if (bgUrl) {
      // Must mirror KenBurns' <Image fill sizes="100vw"> exactly.
      const { props } = getImageProps({ src: bgUrl, alt: '', fill: true, sizes: '100vw' });
      warm({ src: props.src, srcSet: props.srcSet, sizes: props.sizes });
    }

    // Logos / mockups render as plain <img> in their templates, so the raw
    // URL is the right one to warm.
    for (const url of [next?.resolvedMedia?.logoUrl, next?.resolvedMedia?.phoneMockupUrl]) {
      if (url) warm({ src: url });
    }
  }, [currentIndex, pool]);

  // Watchdog: reload page if slide doesn't advance in 3× its expected duration
  useEffect(() => {
    if (pool.length === 0) return;
    const current = pool[currentIndex];
    if (!current) return;
    const expected =
      (current.durationOverrideSec ?? templates[current.templateType]?.defaultDurationSec ?? 15) *
      3 *
      1000;
    const watchdog = setTimeout(() => {
      console.warn('Watchdog: slide did not advance — reloading');
      reportError({
        source: 'player',
        message: 'Watchdog reload — slide did not advance in 3× expected duration',
        displayId,
        slideId: current.id,
        context: { templateType: current.templateType, expectedMs: expected },
      });
      window.location.reload();
    }, expected);
    return () => clearTimeout(watchdog);
  }, [currentIndex, pool, displayId]);

  // Nightly reload at 3 AM Eastern
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      if (ny.getHours() === 3 && ny.getMinutes() === 0) {
        window.location.reload();
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat — once a minute, carrying whatever is on screen right now.
  // The reply tells us the server's playlist version (refetch if it moved)
  // and whether an admin asked this player to reload. One request per
  // minute per display instead of one per slide change.
  const currentSlideIdRef = useRef<string | null>(null);
  currentSlideIdRef.current = pool[currentIndex]?.id ?? null;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function beat() {
      try {
        const res = await fetch(`/api/display/${displayId}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slideId: currentSlideIdRef.current }),
          cache: 'no-store',
          keepalive: true,
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { version?: string | null; reload?: boolean };
        if (data.reload) {
          window.location.reload();
          return;
        }
        if (data.version && data.version !== versionRef.current) {
          void refetch();
        }
      } catch {
        /* network blip — next minute will retry */
      }
    }

    void beat();
    const ping = setInterval(beat, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      clearInterval(ping);
    };
  }, [ready, displayId, refetch]);

  const handleSlideDone = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= pool.length) {
        // Loop boundary — adopt any queued slide update and apply ban filter
        const source = queuedSlidesRef.current ?? slides;
        if (queuedSlidesRef.current) {
          queuedSlidesRef.current = null;
          setSlides(source);
        }
        const filtered = source.filter((s) => !bannedIds.has(s.id));
        setPool(buildShuffledPool(filtered.length > 0 ? filtered : source));
        return 0;
      }
      return next;
    });
  }, [pool.length, slides, bannedIds]);

  // If a slide gets banned mid-cycle, drop it from the live pool too so the
  // rotation doesn't bring it back this cycle.
  useEffect(() => {
    if (bannedIds.size === 0) return;
    setPool((prev) => {
      const filtered = prev.filter((s) => !bannedIds.has(s.id));
      // Keep at least one slide on screen even if everything is banned.
      return filtered.length > 0 ? filtered : prev;
    });
  }, [bannedIds]);

  // Unique bg-video URLs across the pool — passed to BgVideoStack so each
  // is mounted exactly once and persists across slide rotations. Without
  // this, every cycle remounted a fresh <video> and Blob re-streamed the
  // file.
  const poolVideoUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const s of pool) {
      const u = s.resolvedMedia?.bgVideoUrl;
      if (u) urls.add(u);
    }
    return [...urls];
  }, [pool]);

  if (!ready || pool.length === 0) {
    return <div className="w-full h-full bg-navy-900" />;
  }

  const current = pool[currentIndex];
  if (!current) return null;

  const templateConfig = templates[current.templateType];
  if (!templateConfig) return null;

  const holdMs =
    (current.durationOverrideSec ?? templateConfig.defaultDurationSec) * 1000;

  // Pass content + resolved media URLs as extra props
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SlideComponent = templateConfig.component as React.ComponentType<any>;
  const resolved = current.resolvedMedia ?? {};
  const currentVideoUrl = resolved.bgVideoUrl ?? null;

  return (
    <div className="relative w-full h-full bg-navy-900">
      <BgVideoStack urls={poolVideoUrls} activeUrl={currentVideoUrl} />
      <SlideFrame
        slideId={`${current.id}-${currentIndex}`}
        holdMs={holdMs}
        onDone={handleSlideDone}
      >
        <SlideErrorBoundary
          displayId={displayId}
          slideId={current.id}
          templateType={current.templateType}
          onBadSlide={banSlide}
        >
          <SlideComponent
            content={current.content}
            orientation={orientation}
            logoUrl={resolved.logoUrl}
            bgImageUrl={resolved.bgImageUrl}
            bgVideoUrl={resolved.bgVideoUrl}
            bgVideoExternal
            phoneMockupUrl={resolved.phoneMockupUrl}
          />
        </SlideErrorBoundary>
      </SlideFrame>
    </div>
  );
}
