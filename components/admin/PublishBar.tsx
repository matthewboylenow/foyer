'use client';

import { useCallback, useEffect, useState } from 'react';
import { Radio, Check } from 'lucide-react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';

interface Change {
  id: string;
  title: string;
  kind: 'added' | 'changed' | 'removed' | 'turned off' | 'turned on';
}

interface Status {
  publishedAt: string | null;
  publishedBy: string | null;
  reason: string | null;
  slideCount: number;
  dirty: boolean;
  changes: Change[];
}

/** Fired by SlideGrid / SlideEditor after any mutation so the bar refreshes. */
export const SLIDES_CHANGED_EVENT = 'foyer:slides-changed';
export function notifySlidesChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SLIDES_CHANGED_EVENT));
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * The "what's on the screens" strip at the top of the Slides page. Green
 * when the screens match the admin; rust with the list of pending changes
 * and a Publish button when they don't.
 */
export function PublishBar() {
  const [status, setStatus] = useState<Status | null>(null);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/publish/status', { cache: 'no-store' });
      if (res.ok) setStatus((await res.json()) as Status);
    } catch {
      /* keep the last known state */
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 20_000);
    window.addEventListener(SLIDES_CHANGED_EVENT, load);
    return () => {
      clearInterval(poll);
      window.removeEventListener(SLIDES_CHANGED_EVENT, load);
    };
  }, [load]);

  async function publish() {
    setPublishing(true);
    try {
      const res = await fetch('/api/publish', { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const data = (await res.json()) as { slideCount: number };
      toast.success(`Published — ${data.slideCount} slides on the screens within a minute`);
      await load();
    } catch {
      toast.error("Couldn't publish");
    } finally {
      setPublishing(false);
    }
  }

  if (!status) {
    return <div className="h-12 rounded-xl bg-navy/5 animate-pulse" />;
  }

  const never = status.publishedAt === null;
  const dirty = status.dirty;

  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-center gap-3 flex-wrap ${
        dirty ? 'border-rust/40 bg-rust/5' : 'border-emerald-300 bg-emerald-50'
      }`}
    >
      {dirty ? (
        <Radio size={16} className="text-rust shrink-0" />
      ) : (
        <Check size={16} className="text-emerald-600 shrink-0" />
      )}
      <div className="min-w-0 flex-1 text-sm">
        {never ? (
          <>
            <span className="font-medium text-navy">Never published.</span>{' '}
            <span className="text-navy/70">
              The screens are showing every change the moment it is saved. Publish once to
              switch to staged mode: edits wait until you press Publish.
            </span>
          </>
        ) : dirty ? (
          <>
            <span className="font-medium text-navy">
              {status.changes.length} change{status.changes.length === 1 ? '' : 's'} not on the screens yet.
            </span>{' '}
            <span className="text-navy/70">
              {status.changes
                .slice(0, 5)
                .map((c) => `${c.title || 'Untitled'} (${c.kind})`)
                .join(', ')}
              {status.changes.length > 5 ? `, and ${status.changes.length - 5} more` : ''}.
              {' '}Screens still show the set published {when(status.publishedAt!)}.
            </span>
          </>
        ) : (
          <>
            <span className="font-medium text-navy">Screens are up to date.</span>{' '}
            <span className="text-navy/70">
              {status.slideCount} slides, published {when(status.publishedAt!)}
              {status.publishedBy ? ` by ${status.publishedBy}` : ''}
              {status.reason && status.reason !== 'manual' ? ` (${status.reason})` : ''}.
            </span>
          </>
        )}
      </div>
      <Button
        onClick={publish}
        disabled={publishing || (!dirty && !never)}
        className={dirty || never ? 'bg-rust text-cream hover:bg-rust-700' : ''}
        variant={dirty || never ? 'default' : 'outline'}
      >
        {publishing ? 'Publishing…' : 'Publish to screens'}
      </Button>
    </div>
  );
}
