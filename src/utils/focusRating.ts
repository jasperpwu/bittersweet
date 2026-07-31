/**
 * Motion-based focus rating.
 *
 * Turns Core Motion signals captured during a focus session into a suggested
 * 1–5★ rating, and maps that rating onto a fruit-reward multiplier. Because the
 * underlying motion signal is an on-device estimate, not ground truth
 * (stationary motion can't distinguish a phone resting on a desk from one
 * fidgeted in-hand), ambiguous / no-signal cases err toward 5★.
 *
 * The tag's activity type decides whether motion grades the session at all:
 *  - `stationary` / `active` — motion-graded 1–5★, read-only in the summary.
 *  - `self_rated` — motion says nothing useful (phone-based or mixed work), so
 *    the session starts at 5★ and the user sets the stars in the summary modal.
 *    This is also the default for tags with no activity type: an unset type
 *    means we don't know what the phone *should* have been doing, and grading
 *    that as `stationary` silently penalised users who never set one.
 *
 * Signal source: `MotionActivitySummary` — CMMotionActivity stationary/walking/
 * running fractions, queried retroactively over the session window.
 */

export type ActivityType = 'stationary' | 'self_rated' | 'active';
export type RatingSource = 'suggested' | 'user';

/** Applied when a tag has no activity type set. */
export const DEFAULT_ACTIVITY_TYPE: ActivityType = 'self_rated';

/**
 * Values retired from `ActivityType` that may still be persisted locally or in
 * the `session_tags.activity_type` column (plain TEXT, no CHECK constraint), so
 * they're mapped on read rather than migrated.
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

/** How a session's physical motion is characterised. */
export type MotionProfile = 'still' | 'occasional' | 'constant' | 'unknown';

/** Which signal produced the classification (surfaced in the "why" sheet). */
export type MotionSignal = 'activity' | 'none';

/** CMMotionActivity time breakdown (motion-insights native module). */
export interface MotionActivitySummary {
  stationarySec: number;
  walkingSec: number;
  runningSec: number;
  cyclingSec: number;
  automotiveSec: number;
  unknownSec: number;
  totalSec: number;
}

/**
 * Snapshot persisted on the session so the insights sheet still works after the
 * ~7-day Core Motion history window has expired.
 */
export interface MotionSnapshot {
  signal: MotionSignal;
  profile: MotionProfile;
  activity?: MotionActivitySummary | null;
  steps?: number | null;
}

/** Linear 20%-per-star fruit multiplier (locked product decision). */
export const RATING_FRUIT_MULTIPLIER: Record<number, number> = {
  1: 0.2,
  2: 0.4,
  3: 0.6,
  4: 0.8,
  5: 1,
};

/**
 * Sessions shorter than this earn no fruits at all (the reward curve starts
 * here), so there's nothing for a rating to scale — they're left unrated rather
 * than given a rating no measurement stands behind.
 */
export const MIN_RATEABLE_MINUTES = 5;

// --- Classification thresholds (tunable starting heuristics) ---
// Rating is graded purely on the percentage of time the phone was in motion.
const ACTIVITY_CONSTANT_MOVING_FRACTION = 0.5; // ≥ this in walking/running ⇒ constant
const ACTIVITY_STILL_STATIONARY_FRACTION = 0.9; // must be at least this stationary to be "still"
const ACTIVITY_STILL_STEPS_PER_MIN = 0.5; // and below this step rate (≈ <1 step / 2 min)

// Every session begins and ends with an unavoidable phone pickup (to tap
// start/stop), which registers as motion. That's a roughly fixed chunk of time,
// so it's a big slice of a 5-min session but a rounding error on a 60-min one.
// We forgive this many seconds of active time before computing the motion
// fraction, so short sessions aren't penalised for the mandatory start/stop tap.
const HANDLING_GRACE_SEC = 25;
// The same exit walk also shows up as steps; forgive a matching count (~a short
// stand-up-and-leave) so the step-rate override doesn't re-penalise it.
const HANDLING_GRACE_STEPS = 30;

/**
 * Moving / stationary fractions after forgiving the fixed start/stop
 * handling on the CMMotionActivity path — e.g. standing up and taking a few
 * steps to leave when ending a session. Up to HANDLING_GRACE_SEC of locomotion
 * is reattributed to stationary time so short stationary sessions aren't
 * penalised for the unavoidable exit walk. On long sessions it's negligible.
 */
function effectiveActivityFractions(a: MotionActivitySummary): {
  movingFrac: number;
  stationaryFrac: number;
} {
  if (a.totalSec <= 0) return { movingFrac: 0, stationaryFrac: 0 };
  const movingSec = a.walkingSec + a.runningSec + a.cyclingSec + a.automotiveSec;
  const forgiven = Math.min(movingSec, HANDLING_GRACE_SEC);
  return {
    movingFrac: (movingSec - forgiven) / a.totalSec,
    stationaryFrac: (a.stationarySec + forgiven) / a.totalSec,
  };
}

/** Steps after forgiving the short stand-up-and-leave walk (stationary path only). */
function effectiveSteps(steps?: number | null): number | null {
  if (steps == null) return null;
  return Math.max(0, steps - HANDLING_GRACE_STEPS);
}

const clampRating = (r: number): number => Math.max(1, Math.min(5, Math.round(r)));

/** Apply the star rating to a base fruit amount. */
export function fruitsForRating(baseFruits: number, rating: number): number {
  const mult = RATING_FRUIT_MULTIPLIER[clampRating(rating)] ?? 1;
  return Math.round(baseFruits * mult);
}

/** Whether a session is eligible for an auto-suggested rating at all. */
export function shouldAutoRate(opts: {
  durationMinutes: number;
  isManualEntry?: boolean;
}): boolean {
  if (opts.isManualEntry) return false;
  return opts.durationMinutes >= MIN_RATEABLE_MINUTES;
}

function classifyFromActivity(a: MotionActivitySummary, steps?: number | null): MotionProfile {
  if (a.totalSec <= 0) return 'unknown';
  const { movingFrac, stationaryFrac } = effectiveActivityFractions(a);
  const totalMin = a.totalSec / 60;
  const gracedSteps = effectiveSteps(steps);
  const stepsPerMin = gracedSteps != null && totalMin > 0 ? gracedSteps / totalMin : 0;

  // Clear locomotion ⇒ constant motion.
  if (movingFrac >= ACTIVITY_CONSTANT_MOVING_FRACTION) return 'constant';

  // "Still" only when the phone was overwhelmingly stationary AND took almost no
  // steps. Anything less — a non-stationary remainder (e.g. only 76% stationary)
  // or a handful of steps — means the user wasn't fully settled ⇒ occasional.
  if (
    stationaryFrac >= ACTIVITY_STILL_STATIONARY_FRACTION &&
    stepsPerMin <= ACTIVITY_STILL_STEPS_PER_MIN
  ) {
    return 'still';
  }
  return 'occasional';
}

/**
 * Produce a MotionSnapshot from the CMMotionActivity summary; reports `none`
 * when there's no usable activity data.
 */
export function classifyMotion(input: {
  activity?: MotionActivitySummary | null;
  steps?: number | null;
}): MotionSnapshot {
  if (input.activity && input.activity.totalSec > 0) {
    return {
      signal: 'activity',
      profile: classifyFromActivity(input.activity, input.steps),
      activity: input.activity,
      steps: input.steps ?? null,
    };
  }
  return {
    signal: 'none',
    profile: 'unknown',
    activity: input.activity ?? null,
    steps: input.steps ?? null,
  };
}

const clampStars = (n: number): number => Math.max(1, Math.min(5, Math.round(n)));

function movingFractionOf(a: MotionActivitySummary): number {
  return (a.walkingSec + a.runningSec + a.cyclingSec + a.automotiveSec) / a.totalSec;
}

function stepsPerMinOf(a: MotionActivitySummary, steps?: number | null): number {
  const totalMin = a.totalSec / 60;
  return steps != null && totalMin > 0 ? steps / totalMin : 0;
}

/**
 * Stationary tag: graded purely on how stationary the phone was, with a
 * step-rate override for movement the activity classifier may have labelled
 * "unknown". 5★ requires nearly-perfect stillness; each tier down reflects a
 * larger non-stationary slice.
 */
function stationaryStars(snapshot: MotionSnapshot): number {
  if (snapshot.signal === 'activity' && snapshot.activity) {
    // Fractions forgive the fixed start/stop handling (getting up + a few exit
    // steps) so short stationary sessions aren't penalised for it.
    const { movingFrac, stationaryFrac } = effectiveActivityFractions(snapshot.activity);
    if (movingFrac >= 0.5) return 1; // walked/ran most of the session
    let stars =
      stationaryFrac >= 0.95
        ? 5
        : stationaryFrac >= 0.85
          ? 4
          : stationaryFrac >= 0.7
            ? 3
            : stationaryFrac >= 0.5
              ? 2
              : 1;
    const spm = stepsPerMinOf(snapshot.activity, effectiveSteps(snapshot.steps));
    if (spm > 8) stars = Math.min(stars, 2);
    else if (spm > 3) stars = Math.min(stars, 3);
    return clampStars(stars);
  }
  return 5;
}

/**
 * Active tag: the mirror — graded on how much locomotion there was. Sustained
 * walking/running scores highest; a high step cadence can raise a session the
 * activity classifier under-counted.
 */
function activeStars(snapshot: MotionSnapshot): number {
  if (snapshot.signal === 'activity' && snapshot.activity) {
    const a = snapshot.activity;
    const moving = movingFractionOf(a);
    let stars = moving >= 0.7 ? 5 : moving >= 0.5 ? 4 : moving >= 0.3 ? 3 : moving >= 0.1 ? 2 : 1;
    const spm = stepsPerMinOf(a, snapshot.steps);
    if (spm >= 40) stars = Math.max(stars, 4);
    else if (spm >= 15) stars = Math.max(stars, 3);
    return clampStars(stars);
  }
  return 5;
}

/**
 * Suggest a 1–5★ rating from the motion snapshot given the tag's activity type.
 * Tags with no activity type fall back to `self_rated` — an unset type means we
 * don't know what the phone should have been doing, so we don't grade it.
 * `self_rated` and "no usable signal" both yield 5★ (benefit of the doubt — no
 * penalty); for `self_rated` the user can then adjust the stars themselves.
 */
export function suggestRating(
  activityType: ActivityType | undefined,
  snapshot: MotionSnapshot
): number {
  const type = normalizeActivityType(activityType) ?? DEFAULT_ACTIVITY_TYPE;
  // Checked before the signal guard: self-rated sessions are never motion-graded,
  // so the snapshot is irrelevant to their starting rating.
  if (type === 'self_rated') return 5;
  if (snapshot.signal === 'none' || snapshot.profile === 'unknown') return 5;
  switch (type) {
    case 'active':
      return activeStars(snapshot);
    case 'stationary':
    default:
      return stationaryStars(snapshot);
  }
}

/**
 * Whether the stars belong to the user rather than to the motion estimate.
 *
 * True in two situations, which are the same thing from the user's side — the
 * session was handed a flat 5★ that no measurement stands behind:
 *  - the tag isn't motion-graded (`self_rated`, or no activity type), or
 *  - motion came back with nothing to grade: Motion & Fitness access not
 *    granted, or CMMotionActivity simply held no records for the window. Both
 *    write a `signal: 'none'` snapshot.
 *
 * Sessions under MIN_RATEABLE_MINUTES don't reach here at all — they stay
 * unrated, so `focusRating` is null and the summary shows no stars to set.
 *
 * Drives whether the summary modal lets the user set the stars. Deliberately
 * derived from the stored snapshot rather than re-reading the permission, so a
 * session revisited later shows the same affordance it did on completion.
 */
export function isUserRatable(
  activityType: ActivityType | undefined,
  snapshot?: MotionSnapshot | null
): boolean {
  if (isSelfRated(activityType)) return true;
  return !snapshot || snapshot.signal === 'none' || snapshot.profile === 'unknown';
}

/**
 * i18n key for the one-line motion summary in the insights sheet. CMMotionActivity
 * only knows locomotion (walking/running), NOT desk phone-handling, so its strings
 * must not claim "fully focused" — it can't see you pick the phone up at a desk.
 */
export function describeMotionKey(snapshot: MotionSnapshot): string {
  if (snapshot.signal === 'none' || snapshot.profile === 'unknown') {
    return 'ratingInsights.motionNoData';
  }

  switch (snapshot.profile) {
    case 'still':
      return 'ratingInsights.motionActivityStill';
    case 'occasional':
      return 'ratingInsights.motionActivityOccasional';
    case 'constant':
    default:
      return 'ratingInsights.motionActivityConstant';
  }
}
