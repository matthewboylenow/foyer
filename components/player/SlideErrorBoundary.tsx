'use client';

import { Component, type ReactNode } from 'react';
import { reportError } from '@/lib/reportError';

interface Props {
  children: ReactNode;
  displayId: string;
  slideId: string;
  templateType: string;
  /** Called once per slide id when the template throws. Player uses this
   *  to ban the slide from the rotation for the rest of the session. */
  onBadSlide: (slideId: string) => void;
}

interface State {
  errored: boolean;
}

/**
 * Catches throws from a slide template render. On error:
 *  - Reports to /api/errors with full context (display, slide, template).
 *  - Renders a quiet fallback so the SlideFrame's hold timer still ticks
 *    and the player advances naturally.
 *  - Tells the Player to ban this slide so the rotation doesn't re-render
 *    a known-broken template every cycle.
 *
 * Page reloads nightly (3am Eastern), so a banned slide gets re-tried then
 * — if the underlying data was fixed, it'll come back. Otherwise the ban
 * persists until reload.
 */
export class SlideErrorBoundary extends Component<Props, State> {
  state: State = { errored: false };

  static getDerivedStateFromError(): State {
    return { errored: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const { displayId, slideId, templateType } = this.props;
    reportError({
      source: 'player',
      message: `Slide template threw: ${error.message}`,
      stack: error.stack ?? info.componentStack ?? undefined,
      displayId,
      slideId,
      context: { templateType, componentStack: info.componentStack ?? null },
    });
    this.props.onBadSlide(slideId);
  }

  // Reset the errored flag when we receive a different slide id — otherwise
  // we'd render the fallback for every subsequent slide once anything has
  // thrown.
  componentDidUpdate(prevProps: Props) {
    if (prevProps.slideId !== this.props.slideId && this.state.errored) {
      this.setState({ errored: false });
    }
  }

  render() {
    if (this.state.errored) {
      return (
        <div className="relative w-full h-full bg-navy-900 grid place-items-center overflow-hidden">
          <div className="text-center">
            <div className="font-serif text-cream/85 text-6xl font-bold tracking-tight">
              Foyer
            </div>
            <div className="mt-3 text-cream/35 text-xs uppercase tracking-[0.3em]">
              Saint Helen
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
