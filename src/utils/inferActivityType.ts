/**
 * Lightweight, offline inference of a tag's activity type from its name.
 *
 * A keyword heuristic — deliberately NOT an LLM. Classifying 1–3 words into 3
 * buckets doesn't justify bundling a model. It only ever *suggests* — the user
 * can override in the picker.
 *
 * Matching strategy: the name is split into WORDS first (Unicode-aware), then
 * each word is matched against keyword stems by longest-prefix-wins. Word-level
 * matching (not raw substring) is what makes "workout" resolve to `workout`
 * (active) rather than `work` (stationary), and stops "brunch" matching "run".
 *
 * Limitation: keywords are English. Non-English names mostly won't match — that
 * is intentionally left to the on-device model path (Foundation Models) which
 * handles multilingual + word variation natively; this stays the fast fallback.
 */
import type { ActivityType } from './focusRating';

// Keyword stems per category. A word matches a stem if it equals the stem or
// starts with it (so "run" → running, "study" → studying). Longest match wins.
const KEYWORDS: Record<ActivityType, string[]> = {
  active: [
    'run',
    'jog',
    'walk',
    'hike',
    'gym',
    'workout',
    'exercise',
    'lift',
    'weight',
    'cardio',
    'yoga',
    'pilates',
    'stretch',
    'swim',
    'bike',
    'cycl',
    'sport',
    'dance',
    'climb',
    'basketball',
    'soccer',
    'football',
    'tennis',
    'box',
    'martial',
    'fitness',
    'treadmill',
    'marathon',
    'pushup',
    'crossfit',
  ],
  on_phone: [
    'scroll',
    'social',
    'instagram',
    'tiktok',
    'twitter',
    'reddit',
    'youtube',
    'video',
    'watch',
    'browse',
    'game',
    'gaming',
    'text',
    'chat',
    'messag',
    'facetime',
    'news',
    'feed',
    'stream',
    'netflix',
    'movie',
    'tv',
    'podcast',
  ],
  stationary: [
    'read',
    'study',
    'studie',
    'write',
    'writ',
    'code',
    'coding',
    'program',
    'work',
    'focus',
    'meditat',
    'draw',
    'design',
    'paint',
    'journal',
    'homework',
    'exam',
    'learn',
    'research',
    'plan',
    'email',
    'desk',
    'office',
    'lecture',
    'class',
    'book',
    'essay',
    'thesis',
    'math',
    'revis',
    'note',
  ],
};

const ORDER: ActivityType[] = ['active', 'on_phone', 'stationary'];

// Flattened keyword → type entries, longest first so longest-prefix wins.
const ENTRIES: { kw: string; type: ActivityType }[] = ORDER.flatMap((type) =>
  KEYWORDS[type].map((kw) => ({ kw, type }))
).sort((a, b) => b.kw.length - a.kw.length);

/** Best (longest) keyword this word matches, or null. ENTRIES is longest-first. */
function matchWord(word: string): ActivityType | null {
  for (const { kw, type } of ENTRIES) {
    if (word === kw || word.startsWith(kw)) return type;
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

  const scores: Record<ActivityType, number> = { active: 0, on_phone: 0, stationary: 0 };
  for (const word of words) {
    const type = matchWord(word);
    if (type) scores[type] += 1;
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
