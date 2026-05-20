'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SlideFrame } from './SlideFrame';
import { buildShuffledPool, slidesHaveChanged } from './shuffle';
import { templates } from '@/components/templates';
import type { SlideWithContent } from '@/lib/db/schema';

const POLL_INTERVAL_MS = 30_000;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function loadFromCache(displayId: string): SlideWithContent[] {
  try {
    const raw = localStorage.getItem(`lastFetch:${displayId}`);
    if (!raw) return [];
    const { slides, savedAt } = JSON.parse(raw) as { slides: SlideWithContent[]; savedAt: number };
    if (Date.now() - savedAt > CACHE_TTL_MS) return [];
    return slides;
  } catch {
    return [];
  }
}

function saveToCache(displayId: string, slides: SlideWithContent[]) {
  try {
    localStorage.setItem(
      `lastFetch:${displayId}`,
      JSON.stringify({ slides, savedAt: Date.now() }),
    );
  } catch {
    // localStorage unavailable or full — skip
  }
}

const FALLBACK_SLIDE: SlideWithContent = {
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
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  updatedBy: null,
};

interface PlayerProps {
  displayId: string;
}

export function Player({ displayId }: PlayerProps) {
  const [slides, setSlides] = useState<SlideWithContent[]>([]);
  const [pool, setPool] = useState<SlideWithContent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const queuedSlidesRef = useRef<SlideWithContent[] | null>(null);
  const [ready, setReady] = useState(false);

  // Initial load: try API then cache then fallback
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/display/${displayId}`, { cache: 'no-store' });
        if (res.ok) {
          const data: SlideWithContent[] = await res.json();
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
        const data: SlideWithContent[] = await res.json();
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

  // Pre-load next slide's background image
  useEffect(() => {
    if (pool.length === 0) return;
    const next = pool[(currentIndex + 1) % pool.length];
    const content = next?.content;
    if (content && 'bgImageMediaId' in content && content.bgImageMediaId) {
      // Pre-fetch would use the blob URL resolved server-side; handled by the API
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
      window.location.reload();
    }, expected);
    return () => clearTimeout(watchdog);
  }, [currentIndex, pool]);

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

  const handleSlideDone = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (next >= pool.length) {
        // Loop boundary — adopt any queued slide update
        if (queuedSlidesRef.current) {
          const newSlides = queuedSlidesRef.current;
          queuedSlidesRef.current = null;
          setSlides(newSlides);
          setPool(buildShuffledPool(newSlides));
        } else {
          setPool(buildShuffledPool(slides));
        }
        return 0;
      }
      return next;
    });
  }, [pool.length, slides]);

  if (!ready || pool.length === 0) {
    return <div className="w-full h-full bg-navy-900" />;
  }

  const current = pool[currentIndex];
  if (!current) return null;

  const templateConfig = templates[current.templateType];
  if (!templateConfig) return null;

  const holdMs =
    (current.durationOverrideSec ?? templateConfig.defaultDurationSec) * 1000;

  const SlideComponent = templateConfig.component as React.ComponentType<{
    content: SlideWithContent['content'];
  }>;

  return (
    <div className="relative w-full h-full">
      <SlideFrame
        slideId={`${current.id}-${currentIndex}`}
        holdMs={holdMs}
        onDone={handleSlideDone}
      >
        <SlideComponent content={current.content} />
      </SlideFrame>
    </div>
  );
}
