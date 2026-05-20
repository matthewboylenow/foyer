/**
 * Client-side error reporter. POSTs to /api/errors using sendBeacon when
 * available so it survives page unload. Never throws — callers can fire-
 * and-forget. Use from the player, admin error boundaries, and one-off
 * try/catch sites where we want telemetry.
 */
export interface ReportErrorOpts {
  source: 'player' | 'admin' | 'api' | 'unknown';
  message: string;
  stack?: string;
  displayId?: string;
  slideId?: string;
  context?: Record<string, unknown>;
}

export function reportError(opts: ReportErrorOpts) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({
    source: opts.source,
    message: opts.message,
    stack: opts.stack,
    displayId: opts.displayId,
    slideId: opts.slideId,
    context: opts.context,
  });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/errors', blob);
      return;
    }
  } catch {
    /* sendBeacon can throw on some old browsers — fall through */
  }
  try {
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* swallow — error reporting must never error-loop */
  }
}
