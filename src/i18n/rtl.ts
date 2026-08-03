/**
 * Layout direction for the right-to-left languages (Arabic, Urdu).
 *
 * React Native's layout direction is a **native, process-wide** flag, not React
 * state: `I18nManager.forceRTL()` writes to NSUserDefaults and is only read
 * when the bridge starts, so flipping direction always costs an app restart.
 * See https://reactnative.dev/docs/i18nmanager.
 *
 * Two things this module deliberately gets right:
 *
 * 1. **It can never reload-loop.** The naive `if (want !== I18nManager.isRTL)
 *    { forceRTL(); reload(); }` recipe from Expo's own localization guide spins
 *    forever when the native flag doesn't stick (expo/expo#26532, #39752): every
 *    launch sees the same mismatch and reloads again. `reloadRequested` caps us
 *    at one reload per launch, so a stuck flag degrades to "wrong direction"
 *    instead of an unusable app.
 * 2. **It works in dev builds.** `Updates.reloadAsync()` rejects outright in dev
 *    and when expo-updates is disabled, so `DevSettings.reload()` is the
 *    fallback — otherwise this is untestable outside TestFlight.
 *
 * Direction is driven by the *in-app* language, never the device's. Calling
 * `forceRTL` pins it, which is what stops an Arabic device locale from flipping
 * the app for a user who chose English.
 */
import { DevSettings, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

import { isRtlLanguage } from './languages';

/** At most one reload per launch — the loop guard. Module-level on purpose. */
let reloadRequested = false;

/**
 * Permit RTL at all. Must run before the first render, so `src/i18n/index.ts`
 * calls it at import time.
 *
 * On a fresh install this lets iOS auto-detect direction from the device
 * locale, which is the behaviour we want: an Arabic device gets an Arabic,
 * right-to-left first frame. Every later change goes through `forceRTL`.
 */
export function initLayoutDirection(): void {
  I18nManager.allowRTL(true);
}

/** Whether the native layout direction already matches this language. */
export function layoutDirectionMatches(language: string | null | undefined): boolean {
  return I18nManager.isRTL === isRtlLanguage(language);
}

async function reloadApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    // Dev builds and updates-disabled builds land here — reloadAsync rejects in
    // both. DevSettings.reload() tears down and rebuilds the bridge, which is
    // what re-reads the native RTL flag.
    DevSettings.reload();
  }
}

/**
 * Point the native layout direction at `language`, restarting if it changed.
 *
 * No-ops when the direction already matches, so the common case (every launch,
 * every LTR-to-LTR switch) costs one boolean comparison and never restarts.
 *
 * Call this only where a restart is acceptable and any pending writes have
 * already been awaited — see the call sites in `LanguageSelector` and the root
 * layout. Resolves *after* requesting the reload, so don't rely on code that
 * follows it running.
 */
export async function applyLayoutDirection(language: string | null | undefined): Promise<void> {
  if (!language || layoutDirectionMatches(language) || reloadRequested) {
    return;
  }

  const rtl = isRtlLanguage(language);
  reloadRequested = true;

  I18nManager.allowRTL(true);
  I18nManager.forceRTL(rtl);

  await reloadApp();
}
