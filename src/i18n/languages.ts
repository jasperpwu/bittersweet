/**
 * Single source of truth for the languages Bittersweet ships with.
 *
 * `code` must match the locale JSON filenames in `./locales` AND the value
 * stored in the synced `language` preference (unified-store / SyncMapper).
 * When adding a language: add its row here, add `locales/<code>.json`, and
 * register it in the `resources` map in `./index.ts`.
 */
export interface SupportedLanguage {
  /** BCP-47 / i18next locale code (also the locale filename and stored pref). */
  code: string;
  /** English name (for reference / accessibility). */
  label: string;
  /** Endonym — how speakers write the language's name themselves. */
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語' },
  { code: 'ko', label: 'Korean', nativeName: '한국어' },
  { code: 'zh-Hans', label: 'Chinese (Simplified)', nativeName: '简体中文' },
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

export function getLanguageByCode(code: string): SupportedLanguage | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}
