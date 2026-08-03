// Shared push-localization helpers for edge functions.
//
// A remote push carries its own text — the recipient's app isn't running to
// localize it — so every function that pushes has to resolve the language
// itself. The language lives in `user_settings.language`, written by the app's
// settings sync (SyncMapper), and always holds one of the codes in
// SUPPORTED_LANGUAGES (src/i18n/languages.ts). Keep LANGS in step with that list.
//
// ⚠️ Recipient, not actor. These pushes go to OTHER users (inner-circle members,
// a gift's counterparty), so always resolve the language of whoever receives
// the message — never the user who triggered it.

export type Lang =
  | 'en' | 'de' | 'es' | 'fr' | 'ja' | 'ko' | 'pt-BR' | 'zh-Hans'
  | 'hi' | 'bn' | 'ru' | 'ar' | 'ur';

export const LANGS: Lang[] = [
  'en', 'de', 'es', 'fr', 'ja', 'ko', 'pt-BR', 'zh-Hans',
  'hi', 'bn', 'ru', 'ar', 'ur',
];

/** Map an arbitrary stored/device locale onto a language we have copy for. */
export function normalizeLang(raw: string | null | undefined): Lang {
  if (raw && (LANGS as string[]).includes(raw)) return raw as Lang;
  // Tolerate region variants like "pt", "zh", "en-US".
  if (raw?.startsWith('pt')) return 'pt-BR';
  if (raw?.startsWith('zh')) return 'zh-Hans';
  const base = raw?.split('-')[0];
  if (base && (LANGS as string[]).includes(base)) return base as Lang;
  return 'en';
}

/**
 * Resolve each user's language in one batched pass.
 *
 * Users with no `user_settings` row (never signed in, or settings never synced)
 * are simply absent from the map — call sites fall back to English via
 * `langOf`. Chunked because `.in()` has a practical URL-length ceiling.
 */
export async function fetchUserLanguages(
  // deno-lint-ignore no-explicit-any
  client: any,
  userIds: string[]
): Promise<Map<string, Lang>> {
  const map = new Map<string, Lang>();
  const unique = [...new Set(userIds)].filter(Boolean);

  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const { data, error } = await client
      .from('user_settings')
      .select('user_id, language')
      .in('user_id', chunk);
    if (error) {
      console.error('fetchUserLanguages error:', error.message);
      continue; // best-effort: missing rows just fall back to English
    }
    for (const row of data ?? []) {
      map.set(row.user_id, normalizeLang(row.language));
    }
  }

  return map;
}

/** The recipient's language, defaulting to English when we have no setting. */
export function langOf(map: Map<string, Lang>, userId: string): Lang {
  return map.get(userId) ?? 'en';
}

/** Substitute `{token}` placeholders. Values are stringified as-is. */
export function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match
  );
}
