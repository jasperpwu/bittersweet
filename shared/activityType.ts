import type { ActivityType } from './types';

/**
 * Canonicalisation of `session_tags.activity_type`.
 *
 * Lives in `shared/` because `rowToTag` calls it on every pull: the column is
 * plain TEXT with no CHECK constraint, so both clients have to agree on what a
 * retired value means or they disagree about the same row.
 */

/** Applied when a tag has no activity type set. */
export const DEFAULT_ACTIVITY_TYPE: ActivityType = 'self_rated';

/**
 * Values retired from `ActivityType` that may still be persisted locally or in
 * the `session_tags.activity_type` column, so they're mapped on read rather
 * than migrated.
 */
const LEGACY_ACTIVITY_TYPES: Record<string, ActivityType> = {
  // 'on_phone' graded phone-based work leniently (5★ unless you walked half the
  // session). That 4★ dock measured nothing a user could act on, so the category
  // became purely self-rated.
  on_phone: 'self_rated',
};

/** Canonical activity type for a stored value, or undefined when unset/unknown. */
export function normalizeActivityType(
  raw?: ActivityType | string | null
): ActivityType | undefined {
  if (!raw) return undefined;
  if (raw === 'stationary' || raw === 'active' || raw === 'self_rated') return raw;
  return LEGACY_ACTIVITY_TYPES[raw];
}

/**
 * Whether this activity type leaves the stars up to the user — true for
 * `self_rated` and for an unset type, which defaults to it.
 */
export function isSelfRated(activityType?: ActivityType | string | null): boolean {
  return (normalizeActivityType(activityType) ?? DEFAULT_ACTIVITY_TYPE) === 'self_rated';
}
