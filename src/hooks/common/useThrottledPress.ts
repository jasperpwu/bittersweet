import { useCallback, useRef } from 'react';

/**
 * Wraps a press handler so repeat invocations within `delay` ms are ignored.
 *
 * Use for non-navigation action buttons that must not double-fire on a fast
 * double-tap — e.g. the Start/Stop focus toggle (where a second tap would
 * immediately cancel the session it just started), one-shot submits, or
 * purchases.
 *
 * Forward navigation (`router.push` / `navigate` / `replace`) is already
 * deduped globally in `src/utils/navigationGuard.ts`, so this hook is only
 * needed for handlers that mutate state or trigger side effects.
 */
export function useThrottledPress<A extends unknown[]>(
  handler: (...args: A) => void,
  delay = 600,
): (...args: A) => void {
  const lastRef = useRef(0);
  return useCallback(
    (...args: A) => {
      const now = Date.now();
      if (now - lastRef.current < delay) return;
      lastRef.current = now;
      handler(...args);
    },
    [handler, delay],
  );
}
