/**
 * Single source of truth for the languages Bittersweet ships with.
 *
 * `code` must match the locale JSON filenames in `./locales` AND the value
 * stored in the synced `language` preference (unified-store / SyncMapper).
 * When adding a language: add its row here, add `locales/<code>.json`, and
 * register it in the `resources` map in `./index.ts`.
 */
import { getLocales } from 'expo-localization';

export interface SupportedLanguage {
  /** BCP-47 / i18next locale code (also the locale filename and stored pref). */
  code: string;
  /** English name (for reference / accessibility). */
  label: string;
  /** Endonym — how speakers write the language's name themselves. */
  nativeName: string;
  /**
   * Written right-to-left. Drives `I18nManager.forceRTL` — see `./rtl.ts`.
   * Flipping this direction requires an app restart (React Native limitation).
   */
  rtl?: boolean;
  /**
   * Poppins has no glyphs for this language's script, so text must fall back to
   * the iOS system font (SF Pro / SF Arabic / Kohinoor Bengali / PingFang …).
   *
   * Verified against the bundled `assets/fonts/Poppins-*.ttf` cmap tables:
   * Poppins covers Latin and Devanagari (94/128) but has **zero** glyphs for
   * Cyrillic, Bengali, Arabic, Han, Hiragana or Hangul. Without this flag iOS
   * still renders the text — CoreText substitutes per glyph — but a Latin word
   * inside the sentence stays Poppins while everything around it changes face,
   * and the Poppins weight scale is lost. See `resolveFontFamily` in
   * `src/config/fonts.ts`.
   */
  systemFont?: boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語', systemFont: true },
  { code: 'ko', label: 'Korean', nativeName: '한국어', systemFont: true },
  { code: 'zh-Hans', label: 'Chinese (Simplified)', nativeName: '简体中文', systemFont: true },
  // Devanagari is one of the two scripts Poppins ships, so Hindi keeps the brand font.
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', nativeName: 'বাংলা', systemFont: true },
  { code: 'ru', label: 'Russian', nativeName: 'Русский', systemFont: true },
  { code: 'ar', label: 'Arabic', nativeName: 'العربية', rtl: true, systemFont: true },
  { code: 'ur', label: 'Urdu', nativeName: 'اردو', rtl: true, systemFont: true },
];

export const DEFAULT_LANGUAGE = 'en';

const SUPPORTED_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

/**
 * Resolve an arbitrary locale string (e.g. from the device or cloud) to one of
 * our supported codes, or `undefined` if we don't ship it. Matches exact codes
 * first, then falls back to the base language (e.g. `pt-PT` -> `pt-BR`? no;
 * `zh-Hant` -> `zh-Hans`? no). We only collapse on the primary subtag when a
 * region-specific variant isn't shipped (e.g. `es-MX` -> `es`, `fr-CA` -> `fr`).
 */
export function resolveSupportedLanguage(locale: string | null | undefined): string | undefined {
  if (!locale) return undefined;
  if (SUPPORTED_CODES.has(locale)) return locale;
  const base = locale.split('-')[0];
  // Special-case the script/region locales we ship under a specific tag.
  if (base === 'pt') return 'pt-BR';
  if (base === 'zh') return 'zh-Hans';
  if (SUPPORTED_CODES.has(base)) return base;
  return undefined;
}

/**
 * The device's preferred language, resolved to a shipped code (else English).
 *
 * Used both as the initial i18next language and as the default value of the
 * `language` preference on a fresh install, so a first-time user sees the app
 * in their system language instead of English. Synchronous — `getLocales()` is
 * backed by a native constant.
 */
export function getDeviceLanguage(): string {
  // `getLocales()` is the user's whole preference list, most-preferred first —
  // walk it rather than reading only [0], so a device set to [Swedish, German]
  // lands on German (which we ship) instead of falling all the way to English.
  for (const locale of getLocales()) {
    const resolved =
      resolveSupportedLanguage(locale?.languageTag) ??
      resolveSupportedLanguage(locale?.languageCode);
    if (resolved) return resolved;
  }
  return DEFAULT_LANGUAGE;
}

export function getLanguageByCode(code: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

/** Whether a language code is written right-to-left (Arabic, Urdu). */
export function isRtlLanguage(code: string | null | undefined): boolean {
  if (!code) return false;
  return getLanguageByCode(resolveSupportedLanguage(code) ?? '')?.rtl === true;
}

/** Whether a language's script needs the system font instead of Poppins. */
export function usesSystemFont(code: string | null | undefined): boolean {
  if (!code) return false;
  return getLanguageByCode(resolveSupportedLanguage(code) ?? '')?.systemFont === true;
}
