import { useEffect } from 'react';

import { useUnifiedStore } from '../store/unified-store';
import { useAppStore } from '../store';
import { setLanguage } from '../i18n';
import { FamilyControlsModule } from '../modules/BitterSweetFamilyControls';

/**
 * Keeps the active i18next language in sync with the persisted/synced
 * `language` preference. Runs whenever the preference changes — which covers
 * store rehydration on cold start and cloud-pull updates (sign-in / sync), in
 * addition to the user picking a language in the selector.
 */
export function useApplyLanguage(): void {
  const language = useUnifiedStore((state) => state.preferences.language);

  useEffect(() => {
    if (!language) {
      return;
    }
    setLanguage(language).then(() => {
      // The shield config in UserDefaults holds pre-rendered text — rewrite it
      // so blocked-app shields follow the new language too
      const store = useAppStore.getState();
      if (store.blocklist.currentSelectionId) {
        FamilyControlsModule.updateShieldBalance(store.rewards.balance).catch((error) => {
          console.error('Failed to relocalize shield after language change:', error);
        });
      }
    });
  }, [language]);
}
