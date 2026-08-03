/**
 * Cold-start correction for the native layout direction.
 *
 * The direction the app booted with comes from the *device* locale, but the
 * language the user actually chose lives in the persisted preference — so on a
 * launch after picking Arabic (or after a reinstall that pulled `ar` from the
 * cloud) the two disagree and the app has to restart once to agree. This waits
 * for the unified store to rehydrate, then reconciles.
 *
 * Runs exactly once per launch, and `applyLayoutDirection` no-ops unless the
 * direction genuinely differs, so the overwhelmingly common case — an LTR user,
 * every launch — costs one boolean comparison and never restarts.
 *
 * Deliberately *not* folded into `useApplyLanguage`: that effect fires on every
 * change to the preference, including the moment the language selector writes
 * it, which would restart the app before `syncSettings()` had pushed the choice
 * to the cloud. `LanguageSelector` owns the interactive path and calls
 * `applyLayoutDirection` itself once its writes have settled. The gap that
 * leaves — a cloud pull changing the language mid-session — corrects on the
 * next launch, which is acceptable for a single-device app.
 */
import { useEffect } from 'react';

import { applyLayoutDirection } from '../i18n/rtl';
import { useUnifiedStore } from '../store/unified-store';

export function useLayoutDirection(): void {
  useEffect(() => {
    let cancelled = false;

    const reconcile = () => {
      if (cancelled) return;
      void applyLayoutDirection(useUnifiedStore.getState().preferences.language);
    };

    if (useUnifiedStore.persist.hasHydrated()) {
      reconcile();
      return () => {
        cancelled = true;
      };
    }

    const unsubscribe = useUnifiedStore.persist.onFinishHydration(reconcile);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
}
