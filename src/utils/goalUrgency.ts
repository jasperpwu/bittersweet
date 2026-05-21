import { FocusGoal } from '../store/types';
import { getGoalPeriodRange } from './goalProgress';

export type UrgencyLevel = 'low' | 'medium' | 'high';

export interface UrgencyResult {
  isBehindPace: boolean;
  score: number; // 0–1
  level: UrgencyLevel;
  deficit: number; // minutes behind expected pace
}

/**
 * Computes an urgency score (0–1) from a goal's period timing and current progress.
 *
 * - periodFraction = time elapsed / total period time
 * - progressFraction = currentProgress / targetMinutes
 * - isBehindPace = periodFraction > progressFraction
 * - score = rawGap × (1 + periodFraction) — amplifies urgency as the period nears its end
 * - level: 'low' (≤0.33), 'medium' (≤0.66), 'high' (>0.66)
 * - deficit: minutes behind expected pace
 */
export const calculateUrgency = (
  goal: FocusGoal,
  currentProgress: number,
): UrgencyResult => {
  if (goal.targetMinutes <= 0) {
    return { isBehindPace: false, score: 0, level: 'low', deficit: 0 };
  }

  const now = new Date();
  const period = (goal.period as string) === 'yearly' ? 'monthly' : goal.period;
  const { periodStart, periodEnd } = getGoalPeriodRange(
    period as 'daily' | 'weekly' | 'monthly',
    now,
  );

  const totalPeriodMs = periodEnd.getTime() - periodStart.getTime();
  const elapsedMs = now.getTime() - periodStart.getTime();
  const periodFraction = Math.max(0, Math.min(1, elapsedMs / totalPeriodMs));

  const progressFraction = Math.min(currentProgress / goal.targetMinutes, 1);

  const isBehindPace = periodFraction > progressFraction;

  if (!isBehindPace) {
    return { isBehindPace: false, score: 0, level: 'low', deficit: 0 };
  }

  const rawGap = periodFraction - progressFraction;
  const score = Math.min(1, rawGap * (1 + periodFraction));

  const level: UrgencyLevel =
    score <= 0.33 ? 'low' : score <= 0.66 ? 'medium' : 'high';

  const expectedMinutes = periodFraction * goal.targetMinutes;
  const deficit = Math.max(0, Math.round(expectedMinutes - currentProgress));

  return { isBehindPace, score, level, deficit };
};
