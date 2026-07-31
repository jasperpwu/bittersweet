/**
 * Lightweight, offline inference of a tag's activity type from its name.
 *
 * A keyword heuristic — deliberately NOT an LLM. Classifying 1–3 words into 3
 * buckets doesn't justify bundling a model. It only ever *suggests* — the user
 * can override in the picker.
 *
 * i18n: keyword stems live in the locale resources (`activityKeywords.*`). At
 * match time we use the active language's stems PLUS the English baseline, so a
 * Spanish tag "correr", a Japanese tag "勉強", and an English tag "running" all
 * resolve, and mixed-language names still match.
 *
 * `active` is only suggested for locomotion (run/walk/hike/bike) where the
 * phone is near-certainly carried — the active grading gives 1★ to a still
 * phone, so a wrong `active` suggestion is the costliest mistake. Off-body
 * exercise (gym, yoga, swim, ball sports…) lives in the `ambiguous` bucket:
 * those stems claim their word so it can't fall through to a shorter stem of
 * another category ("workout" must not resolve to `work` → stationary), but
 * they score nothing — no suggestion, the user picks.
 *
 * Matching strategy per script:
 *  - Latin (en/es/fr/de/pt): the name is split into WORDS first (Unicode-aware),
 *    then each word is matched against keyword stems by longest-prefix-wins.
 *    Word-level matching (not raw substring) is what makes "workout" resolve to
 *    `workout` (ambiguous) rather than `work` (stationary), and stops "brunch"
 *    matching "run".
 *  - CJK (ja/ko/zh): those scripts have no spaces, so the tokenizer yields one
 *    long run; CJK stems are matched by substring containment (longest-first)
 *    instead of prefix.
 */
import type { ActivityType } from './focusRating';
import i18n from '../i18n';

const ORDER: ActivityType[] = ['active', 'self_rated', 'stationary'];
/** Matchable categories: the three real types plus the no-guess bucket. */
const CATEGORIES = [...ORDER, 'ambiguous'] as const;
type KeywordType = ActivityType | 'ambiguous';

// Any Han / Hiragana / Katakana / Hangul char → match this stem by substring.
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

interface KeywordEntry {
  kw: string;
  type: KeywordType;
  cjk: boolean;
}

/** Read + parse the comma-separated keyword stems for one language. */
function entriesForLang(lng: string): KeywordEntry[] {
  const out: KeywordEntry[] = [];
  for (const type of CATEGORIES) {
    const raw = i18n.t(`activityKeywords.${type}`, { lng });
    if (typeof raw !== 'string' || !raw) continue;
    for (const part of raw.split(',')) {
      const kw = part.trim().toLowerCase();
      if (kw) out.push({ kw, type, cjk: CJK_RE.test(kw) });
    }
  }
  return out;
}

/**
 * Active-language stems + the English baseline, deduped and sorted longest-first
 * so the longest matching stem wins. Rebuilt per call (cheap) so a language
 * switch takes effect immediately.
 */
function buildEntries(): KeywordEntry[] {
  const active = (i18n.language || 'en').toLowerCase();
  const langs = active.startsWith('en') ? ['en'] : [active, 'en'];
  const seen = new Set<string>();
  const entries: KeywordEntry[] = [];
  for (const lng of langs) {
    for (const e of entriesForLang(lng)) {
      const id = `${e.type}:${e.kw}`;
      if (seen.has(id)) continue;
      seen.add(id);
      entries.push(e);
    }
  }
  return entries.sort((a, b) => b.kw.length - a.kw.length);
}

/** Best (longest) keyword this word matches, or null. `entries` is longest-first. */
function matchWord(word: string, entries: KeywordEntry[]): KeywordType | null {
  for (const { kw, type, cjk } of entries) {
    if (cjk ? word.includes(kw) : word === kw || word.startsWith(kw)) return type;
  }
  return null;
}

/**
 * Returns the inferred activity type, or null when nothing matches or the match
 * is ambiguous (a tie across categories) — in which case we don't guess.
 */
export function inferActivityType(tagName: string): ActivityType | null {
  const words = tagName.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  if (words.length === 0) return null;

  const entries = buildEntries();
  const scores: Record<ActivityType, number> = { active: 0, self_rated: 0, stationary: 0 };
  for (const word of words) {
    const type = matchWord(word, entries);
    // 'ambiguous' consumes the word (blocking shorter cross-category stems)
    // but contributes no score — we deliberately don't guess for it.
    if (type && type !== 'ambiguous') scores[type] += 1;
  }

  let best: ActivityType | null = null;
  let bestScore = 0;
  let tie = false;
  for (const type of ORDER) {
    if (scores[type] > bestScore) {
      bestScore = scores[type];
      best = type;
      tie = false;
    } else if (scores[type] === bestScore && bestScore > 0) {
      tie = true;
    }
  }

  return bestScore > 0 && !tie ? best : null;
}
