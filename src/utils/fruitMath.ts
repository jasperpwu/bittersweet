/**
 * Fruit reward math for focus sessions.
 *
 * Lives here rather than in the store so non-store modules (challenge reward
 * math, UI previews) can reuse it without importing `src/store`, which would
 * create an import cycle. `src/store/index.ts` re-exports these for the
 * existing call sites.
 */

import { fruitsForRating } from './focusRating';

// Fruit reward curve. Control points are [minutes, fruits]; reward scales
// smoothly between them by linear interpolation, and past the last point the
// final segment's slope continues so longer set durations keep earning. Tuned
// so the per-minute reward rate is steepest in the 30–60 min sweet spot.
const FRUIT_CURVE_POINTS: readonly (readonly [number, number])[] = [
  [5, 1],
  [30, 5],
  [60, 12],
  [90, 16],
];

/**
 * Whole fruits for N focus minutes via piecewise-linear interpolation of
 * FRUIT_CURVE_POINTS (rounded; the final segment is extrapolated beyond 90 min).
 * Reward starts at the first anchor — 5 min → 1 🍎, nothing before — then grows
 * smoothly, so fruits accrue at irregular minutes rather than on fixed 5-min
 * marks (no "stop on the 5-minute boundary" pressure).
 */
export const fruitsForMinutes = (minutes: number): number => {
  const pts = FRUIT_CURVE_POINTS;
  const m = Math.max(0, minutes);
  if (m < pts[0][0]) return 0; // reward begins at the first anchor (5 min → 1 🍎)
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (m <= x1) return Math.round(y0 + ((m - x0) / (x1 - x0)) * (y1 - y0));
  }
  const [x0, y0] = pts[pts.length - 2];
  const [x1, y1] = pts[pts.length - 1];
  return Math.round(y1 + (m - x1) * ((y1 - y0) / (x1 - x0)));
};

export const calculateFruitsEarnedForDuration = (
  duration: number,
  targetDuration: number = duration,
  multiplier: number = 1
) => {
  const earnedMinutes = Math.max(0, Math.floor(duration));
  // "Over time" beyond the set duration is a visual count-up only — cap counted
  // minutes at the target so it earns no extra fruits.
  const countedMinutes = Math.min(earnedMinutes, Math.max(0, Math.floor(targetDuration)));
  return fruitsForMinutes(countedMinutes) * multiplier;
};

/**
 * Fruits a stored session actually credited.
 *
 * `awardedFruits` is the recorded truth when present, but it is deliberately not
 * synced to the cloud (see migration 20260620), so any session pulled from
 * Supabase — reinstall, sign-in on a new device — comes back without it. Those
 * fall back to re-deriving from the duration curve + rating discount, the same
 * derivation `deleteSession` uses to refund fruits.
 */
export const sessionFruits = (session: {
  awardedFruits?: number;
  duration?: number;
  adjustedDuration?: number;
  initialSetDuration?: number;
  accelerateMultiplier?: number;
  focusRating?: number;
  isManualEntry?: boolean;
}): number => {
  if (typeof session.awardedFruits === 'number') return session.awardedFruits;
  if (session.isManualEntry) return 0;
  const base = calculateFruitsEarnedForDuration(
    session.adjustedDuration ?? session.duration ?? 0,
    session.initialSetDuration ?? session.duration ?? 0,
    session.accelerateMultiplier ?? 1
  );
  return session.focusRating != null ? fruitsForRating(base, session.focusRating) : base;
};
