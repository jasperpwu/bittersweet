/**
 * Deterministic 0–100 weekly focus score + its three sub-scores.
 *
 * The score is a pure formula over the computed stats — never produced by the model —
 * so it's stable, reproducible, and explainable in the UI via its sub-scores.
 */
import type { CoachWeeklyStats, CoachSubScores } from '../../store/types';
import { availableWeekFraction } from './coachStats';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Tunable weights. Quality is dropped and the rest renormalized when nothing was rated.
const W_CONSISTENCY = 0.4;
const W_QUALITY = 0.3;
const W_VOLUME = 0.3;

// Volume headroom: focusing 1.5× your trailing average (or more) maxes the volume score.
const VOLUME_STRETCH = 1.5;
// First-week volume fallback: showing up this many days maxes the volume score.
const FIRST_WEEK_TARGET_DAYS = 5;

export interface ScoreResult {
  focusScore: number;
  subScores: CoachSubScores;
}

export function computeFocusScore(stats: CoachWeeklyStats): ScoreResult {
  // Consistency — goal attainment, or activity regularity when no goals are configured.
  const consistency =
    stats.goalsTracked > 0
      ? (stats.goalsMet / stats.goalsTracked) * 100
      : clamp(stats.activeDays / 7, 0, 1) * 100;

  // Quality — mean focus rating mapped 1★→20 … 5★→100, matching the app's linear
  // 20%-per-star rating economy.
  const hasQuality = stats.ratedCount > 0 && stats.avgRating != null;
  const quality = hasQuality ? clamp(stats.avgRating! / 5, 0, 1) * 100 : 0;

  // Volume — relative to the user's own trailing average so low-volume users aren't
  // punished absolutely; first weeks (no history) fall back to days-shown-up. The
  // baseline is scaled to the days not taken off (paid Off-Marker slots), so a
  // planned-rest week is judged on the days the user meant to show up, not dinged
  // for the rest.
  const availFrac = availableWeekFraction(stats.restFraction ?? 0);
  const effectiveTrailing = stats.trailingAvgMinutes * availFrac;
  const volume =
    effectiveTrailing > 0
      ? (clamp(stats.totalMinutes / effectiveTrailing, 0, VOLUME_STRETCH) / VOLUME_STRETCH) * 100
      : clamp(stats.activeDays / (FIRST_WEEK_TARGET_DAYS * availFrac), 0, 1) * 100;

  // Weighted blend; renormalize without quality when nothing was rated.
  const wq = hasQuality ? W_QUALITY : 0;
  const wTotal = W_CONSISTENCY + wq + W_VOLUME;
  const focusScore = Math.round(
    (consistency * W_CONSISTENCY + quality * wq + volume * W_VOLUME) / wTotal
  );

  return {
    focusScore: clamp(focusScore, 0, 100),
    subScores: {
      consistency: Math.round(consistency),
      quality: Math.round(quality),
      volume: Math.round(volume),
    },
  };
}
