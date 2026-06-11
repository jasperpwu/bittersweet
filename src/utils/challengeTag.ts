/**
 * Helpers for matching a participant's local tag to a challenge's tag.
 *
 * A challenge identifies its tag by name (+ emoji) for display, but each
 * participant tracks progress against their *own* local tag id. When a
 * challengee maps an existing tag to a challenge, that tag's name must match
 * the challenge's tag name — ignoring surrounding whitespace and casing.
 */

/** Normalize a tag name for comparison: strip surrounding spaces, ignore casing. */
export const normalizeTagName = (name: string): string => name.trim().toLowerCase();

/** True when an existing tag's name matches the challenge's tag name. */
export const tagMatchesChallenge = (tagName: string, challengeTagName: string): boolean =>
  normalizeTagName(tagName) === normalizeTagName(challengeTagName);
