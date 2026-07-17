/**
 * Lightweight, offline suggestion of a tag emoji from its name.
 *
 * Same design as `inferActivityType`: a keyword heuristic that only ever
 * *suggests* — the user can override via the emoji picker, and a manual pick
 * always wins (the caller tracks a "touched" flag).
 *
 * i18n: keyword stems live in the locale resources (`emojiKeywords`), an
 * object of emoji → comma-separated stems. At match time we use the active
 * language's stems PLUS the English baseline, so mixed-language names still
 * match.
 *
 * Matching strategy per script (mirrors `inferActivityType`):
 *  - Latin: the name is split into words (Unicode-aware), each word matched
 *    against stems by exact-or-prefix, longest stem wins.
 *  - CJK: no word boundaries, so CJK stems match by substring containment,
 *    longest-first.
 */
import i18n from '../i18n';

// Any Han / Hiragana / Katakana / Hangul char → match this stem by substring.
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

interface EmojiKeywordEntry {
  kw: string;
  emoji: string;
  cjk: boolean;
}

/** Read + parse the emoji → stems map for one language. */
function entriesForLang(lng: string): EmojiKeywordEntry[] {
  const map = i18n.t('emojiKeywords', { lng, returnObjects: true });
  if (typeof map !== 'object' || map === null) return [];
  const out: EmojiKeywordEntry[] = [];
  for (const [emoji, raw] of Object.entries(map)) {
    if (typeof raw !== 'string' || !raw) continue;
    for (const part of raw.split(',')) {
      const kw = part.trim().toLowerCase();
      if (kw) out.push({ kw, emoji, cjk: CJK_RE.test(kw) });
    }
  }
  return out;
}

/**
 * Active-language stems + the English baseline, deduped and sorted
 * longest-first so the longest matching stem wins. Rebuilt per call (cheap)
 * so a language switch takes effect immediately.
 */
function buildEntries(): EmojiKeywordEntry[] {
  const active = (i18n.language || 'en').toLowerCase();
  const langs = active.startsWith('en') ? ['en'] : [active, 'en'];
  const seen = new Set<string>();
  const entries: EmojiKeywordEntry[] = [];
  for (const lng of langs) {
    for (const e of entriesForLang(lng)) {
      const id = `${e.emoji}:${e.kw}`;
      if (seen.has(id)) continue;
      seen.add(id);
      entries.push(e);
    }
  }
  return entries.sort((a, b) => b.kw.length - a.kw.length);
}

/**
 * Returns the suggested emoji for a tag name, or null when nothing matches.
 * Entries are tried longest-stem-first, so the most specific keyword wins
 * (e.g. "workout" → 💪 before "work" → 💼).
 */
export function inferTagEmoji(tagName: string): string | null {
  const words = tagName.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  if (words.length === 0) return null;

  for (const { kw, emoji, cjk } of buildEntries()) {
    for (const word of words) {
      if (cjk ? word.includes(kw) : word === kw || word.startsWith(kw)) return emoji;
    }
  }
  return null;
}
