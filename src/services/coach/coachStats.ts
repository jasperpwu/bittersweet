/**
 * Deterministic weekly aggregation for the AI Focus Coach.
 *
 * This is the "code does the analysis" half: everything the score and the narrator
 * are built from is computed here from raw sessions/goals — always correct, free,
 * and explainable. Reuses the same period/attribution helpers the goals UI uses so
 * the numbers always agree with the rest of the app.
 */
import { FocusGoal } from '../../store/types';
import type { CoachWeeklyStats, CoachTagStat } from '../../store/types';
import {
  getGoalPeriodRange,
  getSessionMinutesInPeriod,
  getTargetForDate,
} from '../../utils/goalProgress';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEK_START_DAY = 1; // Monday — app convention
const TRAILING_WEEKS = 4;

export interface WeekRange {
  weekStart: Date;
  weekEnd: Date;
}

/** Mon–Sun range of the week containing `ref`. */
export function weekRangeFor(ref: Date): WeekRange {
  const { periodStart, periodEnd } = getGoalPeriodRange('weekly', ref, WEEK_START_DAY);
  return { weekStart: periodStart, weekEnd: periodEnd };
}

/** Range of the most recently *completed* week (the one before `ref`'s week). */
export function previousWeekRange(ref: Date = new Date()): WeekRange {
  const prior = new Date(ref);
  prior.setDate(prior.getDate() - 7);
  return weekRangeFor(prior);
}

/**
 * A goal's target expressed as a weekly-equivalent number of minutes, honoring
 * rest-day targets via the existing `getTargetForDate` history lookup.
 */
function weeklyEquivalentTarget(goal: FocusGoal, weekStart: Date, restDays: number[]): number {
  const period = (goal as any).activePeriod || (goal as any).period || 'daily';
  // No-period (cumulative) goals have no weekly pace — exclude from weekly coaching.
  if (period === 'none') return 0;
  if (period === 'weekly') {
    return getTargetForDate(goal, weekStart, restDays, 'weekly');
  }
  if (period === 'monthly') {
    return getTargetForDate(goal, weekStart, restDays, 'monthly') * (7 / 30);
  }
  // daily: sum the per-day targets across the 7 days (rest days contribute their own target)
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    sum += getTargetForDate(goal, d, restDays, 'daily');
  }
  return sum;
}

/** Minutes of focus in [start, end], optionally only sessions touching `tagId`. */
function minutesInRange(sessions: any[], start: Date, end: Date, tagId?: string): number {
  return sessions.reduce((sum, s) => {
    if (tagId && s.tagId !== tagId && s.secondaryTagId !== tagId) return sum;
    return sum + getSessionMinutesInPeriod(s, start, end);
  }, 0);
}

const avgOf = (sessions: any[]): number | null => {
  const rated = sessions.filter((s) => typeof s.focusRating === 'number' && s.focusRating > 0);
  if (rated.length === 0) return null;
  return rated.reduce((sum, s) => sum + s.focusRating, 0) / rated.length;
};

export function computeWeeklyStats(
  allSessions: any[],
  activeGoals: FocusGoal[],
  weekStart: Date,
  weekEnd: Date,
  restDays: number[] = [0, 6]
): CoachWeeklyStats {
  // Sessions overlapping the target week (a session crossing midnight is credited
  // proportionally by getSessionMinutesInPeriod).
  const weekSessions = allSessions.filter(
    (s) => getSessionMinutesInPeriod(s, weekStart, weekEnd) > 0
  );

  const totalMinutes = Math.round(
    weekSessions.reduce((sum, s) => sum + getSessionMinutesInPeriod(s, weekStart, weekEnd), 0)
  );
  const totalSessions = weekSessions.length;

  // Active days — distinct local calendar days with a session start inside the week.
  const dayKeys = new Set<string>();
  weekSessions.forEach((s) => {
    const d = new Date(s.startTime);
    if (d >= weekStart && d <= weekEnd) dayKeys.add(d.toDateString());
  });
  const activeDays = dayKeys.size;

  // Ratings (each session counted once).
  const rated = weekSessions.filter((s) => typeof s.focusRating === 'number' && s.focusRating > 0);
  const ratedCount = rated.length;
  const avgRating = avgOf(weekSessions);

  // Peak hour / weekday by session count.
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<number, number> = {};
  weekSessions.forEach((s) => {
    const d = new Date(s.startTime);
    hourCounts[d.getHours()] = (hourCounts[d.getHours()] || 0) + 1;
    dayCounts[d.getDay()] = (dayCounts[d.getDay()] || 0) + 1;
  });
  const pickPeak = (counts: Record<number, number>): number | null => {
    const entries = Object.entries(counts);
    if (entries.length === 0) return null;
    return Number(entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]);
  };
  const peakHour = pickPeak(hourCounts);
  const peakDayIdx = pickPeak(dayCounts);
  const peakDay = peakDayIdx == null ? null : DAY_NAMES[peakDayIdx];

  // Per-tag breakdown — primary AND secondary tags both credited (matches goal logic).
  const tagIds = new Set<string>();
  weekSessions.forEach((s) => {
    if (s.tagId) tagIds.add(s.tagId);
    if (s.secondaryTagId) tagIds.add(s.secondaryTagId);
  });
  const byTag: CoachTagStat[] = Array.from(tagIds)
    .map((tagId) => {
      const tagSessions = weekSessions.filter(
        (s) => s.tagId === tagId || s.secondaryTagId === tagId
      );
      return {
        tagId,
        minutes: Math.round(minutesInRange(tagSessions, weekStart, weekEnd, tagId)),
        sessions: tagSessions.length,
        avgRating: avgOf(tagSessions),
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  // Trailing 4-week average — only counting weeks at/after the user's first-ever session,
  // so brand-new users aren't dragged down by empty pre-history weeks.
  const firstSessionMs = allSessions.reduce(
    (min, s) => Math.min(min, new Date(s.startTime).getTime()),
    Infinity
  );
  let trailingSum = 0;
  let trailingWeeks = 0;
  for (let i = 1; i <= TRAILING_WEEKS; i++) {
    const ref = new Date(weekStart);
    ref.setDate(weekStart.getDate() - i * 7);
    const { periodStart, periodEnd } = getGoalPeriodRange('weekly', ref, WEEK_START_DAY);
    if (Number.isFinite(firstSessionMs) && periodEnd.getTime() < firstSessionMs) continue;
    trailingSum += minutesInRange(allSessions, periodStart, periodEnd);
    trailingWeeks++;
  }
  const trailingAvgMinutes = trailingWeeks > 0 ? Math.round(trailingSum / trailingWeeks) : 0;

  // Goal attainment for the week.
  let goalsTracked = 0;
  let goalsMet = 0;
  activeGoals.forEach((goal) => {
    const target = weeklyEquivalentTarget(goal, weekStart, restDays);
    if (target <= 0) return;
    goalsTracked++;
    const got = minutesInRange(allSessions, weekStart, weekEnd, (goal as any).tagId);
    if (got >= target) goalsMet++;
  });

  return {
    totalMinutes,
    totalSessions,
    activeDays,
    avgRating,
    ratedCount,
    peakHour,
    peakDay,
    trailingAvgMinutes,
    deltaMinutesVsTrailingAvg: totalMinutes - trailingAvgMinutes,
    byTag,
    goalsTracked,
    goalsMet,
  };
}
