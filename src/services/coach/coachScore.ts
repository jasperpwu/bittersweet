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

export interface ScoreResult {
  focusScore: number;
  subScores: CoachSubScores;
}

export function computeFocusScore(stats: CoachWeeklyStats): ScoreResult {
  // Consistency — mean partial attainment across tracked goals (daily goals score by
  // days-hit), or activity regularity when no goals are configured. Partial credit is
  // the point: grading each goal as a single pass/fail on its summed weekly target made
  // a 5-of-7 week score the same zero as a week with nothing in it.
  // Older reports predate `goalAttainment`; those fall back to the binary hit rate.
  // Rest days are planned, not absences, so they must not cap the no-goals fallback.
  const consistency =
    stats.goalsTracked > 0
      ? clamp(stats.goalAttainment ?? stats.goalsMet / stats.goalsTracked, 0, 1) * 100
      : clamp(stats.activeDays / (stats.expectedDays || 7), 0, 1) * 100;

  // Quality — mean focus rating mapped 1★→20 … 5★→100, matching the app's linear
  // 20%-per-star rating economy.
  const hasQuality = stats.ratedCount > 0 && stats.avgRating != null;
  const quality = hasQuality ? clamp(stats.avgRating! / 5, 0, 1) * 100 : 0;

  // Volume — the hours half of the same question consistency answers with days: did
  // you put in the time you meant to, measured per goal against that goal's own target
  // and its own off-marks. Nothing global is invented, so one goal's day off can't
  // move another goal's score.
  //
  // Users with no targeted goals fall back to their own TYPICAL week (median of the
  // trailing 4 — median, not mean, so one big week doesn't raise the bar on the weeks
  // after it), scaled to the days not taken off so a planned-rest week reads as neutral.
  // With neither targets nor history there is nothing honest to divide by, so volume is
  // dropped from the blend entirely rather than measured against an invented reference.
  const availFrac = availableWeekFraction(stats.restFraction ?? 0);
  const baseline = (stats.typicalWeekMinutes ?? stats.trailingAvgMinutes) * availFrac;
  const volume =
    stats.goalHoursAttainment != null
      ? clamp(stats.goalHoursAttainment, 0, 1) * 100
      : baseline > 0
        ? clamp(stats.totalMinutes / baseline, 0, 1) * 100
        : null;

  // Weighted blend, renormalized over whichever sub-scores the week can actually
  // support. Quality drops out when nothing was rated, and its weight otherwise scales
  // with how much of the week was rated — one rated session out of ten shouldn't set
  // 30% of the score, and rating a single rough session honestly shouldn't score worse
  // than not rating at all. Volume drops out when there's nothing to measure against.
  // Consistency always carries weight, so the divisor can never reach zero.
  const ratedCoverage =
    stats.totalSessions > 0 ? clamp(stats.ratedCount / stats.totalSessions, 0, 1) : 0;
  const wq = hasQuality ? W_QUALITY * ratedCoverage : 0;
  const wv = volume != null ? W_VOLUME : 0;
  const wTotal = W_CONSISTENCY + wq + wv;
  const focusScore = Math.round(
    (consistency * W_CONSISTENCY + quality * wq + (volume ?? 0) * wv) / wTotal
  );

  return {
    focusScore: clamp(focusScore, 0, 100),
    subScores: {
      consistency: Math.round(consistency),
      quality: Math.round(quality),
      volume: volume == null ? null : Math.round(volume),
    },
  };
}
