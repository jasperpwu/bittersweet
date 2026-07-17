/**
 * Motion-based focus rating.
 *
 * Turns Core Motion signals captured during a focus session into a suggested
 * 1–5★ rating, and maps that rating onto a fruit-reward multiplier. The rating
 * is applied automatically and shown read-only in the summary modal; the tag's
 * activity type is the user's lever for accuracy. Because the underlying motion
 * signal is an on-device estimate, not ground truth (CMSensorRecorder is
 * unreliable on iPhone, and stationary motion can't distinguish a phone on a
 * desk from one fidgeted in-hand), ambiguous/no-signal cases err toward 5★.
 *
 * Two signal sources, in priority order:
 *  1. `RecordedAccelSummary` — fine-grained raw-accelerometer summary from
 *     CMSensorRecorder (preferred; can detect occasional in-seat handling).
 *  2. `MotionActivitySummary` — CMMotionActivity stationary/walking/running
 *     fractions (reliable fallback when the recorder buffer is empty).
 */

export type ActivityType = 'stationary' | 'on_phone' | 'active';
export type RatingSource = 'suggested' | 'user';

/** How a session's physical motion is characterised. */
export type MotionProfile = 'still' | 'occasional' | 'constant' | 'unknown';

/** Which signal produced the classification (surfaced in the "why" sheet). */
export type MotionSignal = 'recorder' | 'activity' | 'none';

/** Raw-accelerometer summary from CMSensorRecorder (motion-insights native module). */
export interface RecordedAccelSummary {
  sampleCount: number;
  durationSec: number;
  /** Fraction (0–1) of windows whose motion magnitude exceeded the still threshold. */
  activeFraction: number;
  /** Count of distinct movement bursts — a proxy for "times the phone was handled". */
  handlingEvents: number;
}

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
  recorder?: RecordedAccelSummary | null;
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

/** Sessions shorter than this are too noisy to rate — default to full reward. */
export const MIN_RATEABLE_MINUTES = 5;

// --- Classification thresholds (tunable starting heuristics) ---
const ACCEL_CONSTANT_ACTIVE_FRACTION = 0.5; // ≥ this active ⇒ constant motion
const ACCEL_STILL_ACTIVE_FRACTION = 0.08; // < this active (and few bursts) ⇒ still
const ACCEL_OCCASIONAL_MIN_EVENTS = 2; // ≥ this many bursts ⇒ at least occasional
const ACTIVITY_CONSTANT_MOVING_FRACTION = 0.5; // ≥ this in walking/running ⇒ constant
const ACTIVITY_STILL_STATIONARY_FRACTION = 0.9; // must be at least this stationary to be "still"
const ACTIVITY_STILL_STEPS_PER_MIN = 0.5; // and below this step rate (≈ <1 step / 2 min)

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

function classifyFromRecorder(r: RecordedAccelSummary): MotionProfile {
  if (r.sampleCount <= 0) return 'unknown';
  if (r.activeFraction >= ACCEL_CONSTANT_ACTIVE_FRACTION) return 'constant';
  if (
    r.handlingEvents >= ACCEL_OCCASIONAL_MIN_EVENTS ||
    r.activeFraction >= ACCEL_STILL_ACTIVE_FRACTION
  ) {
    return 'occasional';
  }
  return 'still';
}

function classifyFromActivity(a: MotionActivitySummary, steps?: number | null): MotionProfile {
  if (a.totalSec <= 0) return 'unknown';
  const movingFrac = (a.walkingSec + a.runningSec + a.cyclingSec + a.automotiveSec) / a.totalSec;
  const stationaryFrac = a.stationarySec / a.totalSec;
  const totalMin = a.totalSec / 60;
  const stepsPerMin = steps != null && totalMin > 0 ? steps / totalMin : 0;

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
 * Pick the best available signal and produce a MotionSnapshot. Prefers the
 * recorder; falls back to CMMotionActivity; otherwise reports `none`.
 */
export function classifyMotion(input: {
  recorder?: RecordedAccelSummary | null;
  activity?: MotionActivitySummary | null;
  steps?: number | null;
}): MotionSnapshot {
  if (input.recorder && input.recorder.sampleCount > 0) {
    return {
      signal: 'recorder',
      profile: classifyFromRecorder(input.recorder),
      recorder: input.recorder,
      activity: input.activity ?? null,
      steps: input.steps ?? null,
    };
  }
  if (input.activity && input.activity.totalSec > 0) {
    return {
      signal: 'activity',
      profile: classifyFromActivity(input.activity, input.steps),
      recorder: null,
      activity: input.activity,
      steps: input.steps ?? null,
    };
  }
  return {
    signal: 'none',
    profile: 'unknown',
    recorder: null,
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
  if (snapshot.signal === 'recorder' && snapshot.recorder) {
    const r = snapshot.recorder;
    let stars =
      r.activeFraction <= 0.05
        ? 5
        : r.activeFraction <= 0.15
          ? 4
          : r.activeFraction <= 0.3
            ? 3
            : r.activeFraction <= 0.5
              ? 2
              : 1;
    if (r.handlingEvents >= 8) stars = Math.min(stars, 2);
    else if (r.handlingEvents >= 3) stars = Math.min(stars, 3);
    return clampStars(stars);
  }
  if (snapshot.signal === 'activity' && snapshot.activity) {
    const a = snapshot.activity;
    if (movingFractionOf(a) >= 0.5) return 1; // walked/ran most of the session
    const stationaryFrac = a.stationarySec / a.totalSec;
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
    const spm = stepsPerMinOf(a, snapshot.steps);
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
  if (snapshot.signal === 'recorder' && snapshot.recorder) {
    const f = snapshot.recorder.activeFraction;
    return clampStars(f >= 0.5 ? 5 : f >= 0.3 ? 4 : f >= 0.15 ? 3 : f >= 0.05 ? 2 : 1);
  }
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

/** On-phone tag: lenient — full reward unless in near-constant locomotion. */
function onPhoneStars(snapshot: MotionSnapshot): number {
  const heavyMotion =
    (snapshot.signal === 'recorder' && (snapshot.recorder?.activeFraction ?? 0) >= 0.5) ||
    (snapshot.signal === 'activity' &&
      snapshot.activity &&
      movingFractionOf(snapshot.activity) >= 0.5);
  return heavyMotion ? 4 : 5;
}

/**
 * Suggest a 1–5★ rating from the motion snapshot given the tag's activity type.
 * Tags with no activity type are treated as `stationary` (locked decision).
 * No usable signal always yields 5★ (benefit of the doubt — no penalty).
 */
export function suggestRating(
  activityType: ActivityType | undefined,
  snapshot: MotionSnapshot
): number {
  if (snapshot.signal === 'none' || snapshot.profile === 'unknown') return 5;
  const type: ActivityType = activityType ?? 'stationary';
  switch (type) {
    case 'active':
      return activeStars(snapshot);
    case 'on_phone':
      return onPhoneStars(snapshot);
    case 'stationary':
    default:
      return stationaryStars(snapshot);
  }
}

/**
 * i18n key for the one-line motion summary in the insights sheet. Wording is
 * signal-aware: the `activity` fallback only knows locomotion (walking/running),
 * NOT phone handling, so its strings must not claim "fully focused" — it can't
 * see you pick the phone up at a desk. Only the `recorder` signal can speak to
 * handling.
 */
export function describeMotionKey(snapshot: MotionSnapshot): string {
  if (snapshot.signal === 'none' || snapshot.profile === 'unknown') {
    return 'ratingInsights.motionNoData';
  }

  if (snapshot.signal === 'activity') {
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

  // recorder signal — fine-grained, can speak to phone handling
  switch (snapshot.profile) {
    case 'still':
      return 'ratingInsights.motionRecorderStill';
    case 'occasional':
      return 'ratingInsights.motionRecorderOccasional';
    case 'constant':
    default:
      return 'ratingInsights.motionRecorderConstant';
  }
}
