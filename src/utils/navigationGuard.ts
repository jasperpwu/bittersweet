import { router } from 'expo-router';

/**
 * Global guard against duplicate navigations caused by fast double-taps.
 *
 * Expo Router's imperative `router.push` / `navigate` / `replace` dispatch
 * unconditionally, so two taps a few milliseconds apart push the same screen
 * (or `(modals)/*` route) twice. This wraps those three methods once so an
 * *identical* navigation (same method + same args) is ignored if it fires
 * within DEDUPE_WINDOW_MS of the previous one. Different destinations, and
 * genuine revisits after the window, are unaffected.
 *
 * Only forward navigation is guarded — `back`/`dismiss` are intentionally left
 * alone so intentional multi-step pops still work.
 *
 * NOTE: this mutates the expo-router `router` singleton's methods. They are
 * plain (non-`this`-bound) function refs in expo-router today; re-verify on
 * expo-router upgrades.
 */

const DEDUPE_WINDOW_MS = 800;

let lastKey = '';
let lastTime = 0;

function dedupe<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => R,
): (...args: A) => R | undefined {
  return (...args: A): R | undefined => {
    const key = name + JSON.stringify(args);
    const now = Date.now();
    if (key === lastKey && now - lastTime < DEDUPE_WINDOW_MS) {
      return undefined;
    }
    lastKey = key;
    lastTime = now;
    return fn(...args);
  };
}

let installed = false;

export function installNavigationGuard(): void {
  if (installed) return;
  installed = true;
  router.push = dedupe('push', router.push.bind(router)) as typeof router.push;
  router.navigate = dedupe('navigate', router.navigate.bind(router)) as typeof router.navigate;
  router.replace = dedupe('replace', router.replace.bind(router)) as typeof router.replace;
}
