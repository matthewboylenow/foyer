'use client';

import { useEffect, useRef } from 'react';

type Modifier = 'meta' | 'ctrl' | 'shift' | 'alt';

interface HotkeyOptions {
  /** Required modifier keys. 'meta' on Mac, 'ctrl' on Win/Linux — pass 'mod'
   *  via the helper key string ("mod+s") to accept either. */
  modifiers?: Modifier[];
  /** When true, fires even when focus is inside an input/textarea. */
  allowInInputs?: boolean;
}

/**
 * Minimal hotkey hook. Pass a key (case-insensitive, single character or
 * 'Escape', 'Enter' etc.) and a handler. Supports modifier combos via the
 * `modifiers` option, or use the 'mod+s' string form which accepts ⌘ on
 * Mac and Ctrl elsewhere.
 *
 *   useHotkey('mod+s', () => save())
 *   useHotkey('/', () => focusSearch())
 *   useHotkey('Escape', () => close())
 */
export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  options: HotkeyOptions = {},
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const parts = combo.split('+').map((p) => p.trim().toLowerCase());
    const key = parts[parts.length - 1];
    const wantMod = parts.includes('mod');
    const wantShift = parts.includes('shift');
    const wantAlt = parts.includes('alt');
    const explicitMeta = parts.includes('meta');
    const explicitCtrl = parts.includes('ctrl');

    function onKeyDown(e: KeyboardEvent) {
      const pressedKey = e.key.toLowerCase();
      if (pressedKey !== key && e.code.toLowerCase() !== `key${key}`) return;

      // Mod = meta on Mac, ctrl elsewhere. Browsers don't directly tell us
      // the platform reliably; navigator.platform is deprecated. Use
      // metaKey || ctrlKey as the "either" signal.
      const modOk = wantMod ? e.metaKey || e.ctrlKey : true;
      const metaOk = explicitMeta ? e.metaKey : wantMod || !e.metaKey;
      const ctrlOk = explicitCtrl ? e.ctrlKey : wantMod || !e.ctrlKey;
      const shiftOk = wantShift ? e.shiftKey : !e.shiftKey;
      const altOk = wantAlt ? e.altKey : !e.altKey;
      if (!(modOk && metaOk && ctrlOk && shiftOk && altOk)) return;

      if (!options.allowInInputs) {
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.isContentEditable)
        ) {
          // Allow mod+s even in inputs (saving from a focused field is expected).
          if (!wantMod) return;
        }
      }

      handlerRef.current(e);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, options.allowInInputs]);
}
