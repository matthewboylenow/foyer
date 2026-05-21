'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SlideFrame } from './SlideFrame';
import { SlideErrorBoundary } from './SlideErrorBoundary';
import { buildShuffledPool, slidesHaveChanged } from './shuffle';
import { templates } from '@/components/templates';
import { reportError } from '@/lib/reportError';
import type { SlideWithContent } from '@/lib/db/schema';

type PlayerSlide = SlideWithContent & {
  resolvedMedia?: Record<string, string>;
};

const POLL_INTERVAL_MS = 30_000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function loadFromCache(displayId: string): PlayerSlide[] {
  try {
    const raw = localStorage.getItem(`lastFetch:${displayId}`);
    if (!raw) return [];
    const { slides, savedAt } = JSON.parse(raw) as { slides: PlayerSlide[]; savedAt: number };
    if (Date.now() - savedAt > CACHE_TTL_MS) return [];
    return slides;
  } catch {
    return [];
  }
}

function saveToCache(displayId: string, slides: PlayerSlide[]) {
  try {
    localStorage.setItem(
      `lastFetch:${displayId}`,
      JSON.stringify({ slides, savedAt: Date.now() }),
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
  const [slides, setSlides] = useState<PlayerSlide[]>([]);
  const [pool, setPool] = useState<PlayerSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const queuedSlidesRef = useRef<PlayerSlide[] | null>(null);
  const [ready, setReady] = useState(false);
  // Slides whose templates have thrown during this session — filtered out
  // of the pool on next rebuild so we don't loop on a broken slide.
  const [bannedIds, setBannedIds] = useState<Set<string>>(() => new Set());

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
          const data: PlayerSlide[] = await res.json();
          if (data.length > 0) {
            saveToCache(displayId, data);
            setSlides(data);
            setPool(buildShuffledPool(data));
            setReady(true);
            return;
          }
        }
      } catch {
        // network failed
      }

      const cached = loadFromCache(displayId);
      if (cached.length > 0) {
        setSlides(cached);
        setPool(buildShuffledPool(cached));
      } else {
        setSlides([FALLBACK_SLIDE]);
        setPool([FALLBACK_SLIDE]);
      }
      setReady(true);
    }
    init();
  }, [displayId]);

  // Poll for updates
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/display/${displayId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data: PlayerSlide[] = await res.json();
        if (slidesHaveChanged(slides, data)) {
          queuedSlidesRef.current = data;
          saveToCache(displayId, data);
        }
      } catch {
        // network blip — continue from current data
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [displayId, slides, ready]);

  // Pre-decode the next slide's media during the current slide's hold so
  // image decode never blocks the cross-dissolve. Without this, the new
  // template mounts and Image decode hitches the GPU exactly when the
  // transition is supposed to be smooth — the "bloated cut" feeling.
  useEffect(() => {
    if (pool.length === 0) return;
    const next = pool[(currentIndex + 1) % pool.length];
    const imgUrls = [
      next?.resolvedMedia?.bgImageUrl,
      next?.resolvedMedia?.logoUrl,
      next?.resolvedMedia?.phoneMockupUrl,
    ].filter((u): u is string => Boolean(u));

    for (const url of imgUrls) {
      const img = new window.Image();
      img.src = url;
      // Hint to the browser to decode off the main thread when supported.
      if (typeof img.decode === 'function') {
        img.decode().catch(() => {
          // Decode can reject if the resource is replaced — safe to ignore.
        });
      }
    }

    // Warm the HTTP cache for the next slide's background video so the
    // <video> element doesn't sit on a black/gradient fallback for several
    // seconds while it downloads 8+ MB. We use fetch() instead of a hidden
    // <video preload=auto> because Tizen/OptiSigns is unreliable about
    // honoring preload on detached video elements, but does cache plain
    // GET responses. AbortController lets us cancel if the slide rotates
    // before the fetch completes.
    const videoUrl = next?.resolvedMedia?.bgVideoUrl;
    if (!videoUrl) return;
    const ctrl = new AbortController();
    fetch(videoUrl, { signal: ctrl.signal, cache: 'force-cache' }).catch(() => {
      /* network blip or aborted — playback fetch will retry */
    });
    return () => ctrl.abort();
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

  // Heartbeat — tell the admin what's currently on screen. Fires on every
  // slide change AND every 60s as a liveness ping (so an idle TV stuck on
  // the same slide still reads as "online" in the admin).
  useEffect(() => {
    if (!ready || pool.length === 0) return;
    const current = pool[currentIndex];
    if (!current) return;

    const payload = JSON.stringify({ slideId: current.id });
    const url = `/api/display/${displayId}/heartbeat`;

    // Use sendBeacon when available — it survives page navigation/unload
    // and doesn't block. Fall back to fetch.
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      } else {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {
          /* network blip — next slide change will retry */
        });
      }
    } catch {
      /* sendBeacon can throw on some Tizen builds — swallow */
    }

    const ping = setInterval(() => {
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        } else {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        /* swallow */
      }
    }, 60_000);
    return () => clearInterval(ping);
  }, [currentIndex, pool, ready, displayId]);

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

  return (
    <div className="relative w-full h-full">
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
            logoUrl={resolved.logoUrl}
            bgImageUrl={resolved.bgImageUrl}
            bgVideoUrl={resolved.bgVideoUrl}
            phoneMockupUrl={resolved.phoneMockupUrl}
          />
        </SlideErrorBoundary>
      </SlideFrame>
    </div>
  );
}
