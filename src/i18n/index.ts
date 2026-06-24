/**
 * i18next setup for Bittersweet.
 *
 * Imported for its side effect (initialization) from `app/_layout.tsx` BEFORE
 * the app renders. The initial language is the device locale (resolved to a
 * shipped language, else English) — this is synchronous so the very first frame
 * is already localized. The persisted/synced `language` preference loads
 * asynchronously from AsyncStorage and is applied afterwards by
 * `useApplyLanguage()` once the unified store rehydrates.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import { DEFAULT_LANGUAGE, resolveSupportedLanguage } from './languages';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import ptBR from './locales/pt-BR.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zhHans from './locales/zh-Hans.json';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  'pt-BR': { translation: ptBR },
  ja: { translation: ja },
  ko: { translation: ko },
  'zh-Hans': { translation: zhHans },
} as const;

const deviceLanguage =
  resolveSupportedLanguage(getLocales()[0]?.languageTag) ??
  resolveSupportedLanguage(getLocales()[0]?.languageCode) ??
  DEFAULT_LANGUAGE;

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage,
  fallbackLng: DEFAULT_LANGUAGE,
  // RN's Hermes engine has a full Intl.PluralRules, so the modern JSON v4 plural
  // suffixes (_one/_other/...) work without a compat shim.
  compatibilityJSON: 'v4',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Switch the active UI language. No-op if already active. */
export function setLanguage(code: string): void {
  if (i18n.language !== code) {
    i18n.changeLanguage(code);
  }
}

export default i18n;
