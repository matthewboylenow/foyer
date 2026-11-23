'use client';

import { Component, type ReactNode } from 'react';
import { reportError } from '@/lib/reportError';

interface Props {
  displayId: string;
  children: ReactNode;
}

interface State {
  errored: boolean;
}

/** Reload after this long on a crash, with a longer wait on repeat crashes
 *  so a bad build cannot turn the TV into a reload loop. */
const RELOAD_AFTER_MS = 45_000;
const STORAGE_KEY = 'foyer:crashes';

/**
 * Last line of defense around the whole player. A per-slide boundary
 * already bans a broken slide; this catches anything above that (the
 * video layer, the frame, the fetch loop) and, instead of Next's
 * "Application error" page, shows the parish name on navy, reports once,
 * and reloads after a pause. Each repeat crash within ten minutes doubles
 * the pause, up to ten minutes.
 */
export class PlayerBoundary extends Component<Props, State> {
  state: State = { errored: false };
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): State {
    return { errored: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const crashes = this.noteCrash();
    reportError({
      source: 'player',
      message: `Player crashed: ${error.message}`,
      stack: error.stack ?? info.componentStack ?? undefined,
      displayId: this.props.displayId,
      context: { componentStack: info.componentStack ?? null, crashesLast10Min: crashes },
    });
    const wait = Math.min(RELOAD_AFTER_MS * 2 ** Math.max(0, crashes - 1), 10 * 60_000);
    this.timer = setTimeout(() => window.location.reload(), wait);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  /** Count crashes in the last ten minutes (localStorage; best effort). */
  private noteCrash(): number {
    try {
      const now = Date.now();
      const prior = (JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as number[]).filter((t) => now - t < 10 * 60_000);
      prior.push(now);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prior));
      return prior.length;
    } catch {
      return 1;
    }
  }

  render() {
    if (!this.state.errored) return this.props.children;
    return (
      <div
        className="w-full h-full flex items-center justify-center bg-navy-900 text-cream font-serif"
        style={{ fontSize: 'min(72px, 8vw)', textAlign: 'center', padding: '8vw', lineHeight: 1.2 }}
      >
        Saint Helen Parish
      </div>
    );
  }
}
