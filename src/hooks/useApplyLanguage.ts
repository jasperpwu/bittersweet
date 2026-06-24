import { useEffect } from 'react';

import { useUnifiedStore } from '../store/unified-store';
import { setLanguage } from '../i18n';

/**
 * Keeps the active i18next language in sync with the persisted/synced
 * `language` preference. Runs whenever the preference changes — which covers
 * store rehydration on cold start and cloud-pull updates (sign-in / sync), in
 * addition to the user picking a language in the selector.
 */
export function useApplyLanguage(): void {
  const language = useUnifiedStore((state) => state.preferences.language);

  useEffect(() => {
    if (language) {
      setLanguage(language);
    }
  }, [language]);
}
