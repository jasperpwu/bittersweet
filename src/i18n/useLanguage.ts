/**
 * Subscribe to the active i18next language.
 *
 * `useTranslation()` already re-renders on a language change, but components
 * that only need the *code* (to pick a font or a date format) shouldn't pay for
 * a whole translation binding. This is the cheap version: one `languageChanged`
 * listener feeding `useSyncExternalStore`.
 *
 * Typography uses it on nearly a thousand call sites, so it must stay light —
 * do not add work to `getSnapshot`, which React calls on every render.
 */
import { useSyncExternalStore } from 'react';

import i18n from './index';

function subscribe(onStoreChange: () => void): () => void {
  i18n.on('languageChanged', onStoreChange);
  return () => {
    i18n.off('languageChanged', onStoreChange);
  };
}

function getSnapshot(): string {
  return i18n.language;
}

export function useLanguage(): string {
  return useSyncExternalStore(subscribe, getSnapshot);
}
