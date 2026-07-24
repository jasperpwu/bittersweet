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
  getGoalOffKeys,
  getGoalPeriodRange,
  getPeriodKey,
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
 * A goal's weekly attainment, honoring rest-day targets AND paid Off-Marker slots.
 * Off-marked periods are skipped entirely — as if they never existed — matching the
 * streak walker (`calculateGoalStreak`) and consistency calendar, so a week the user
 * paid fruit to take off is never counted as tracked-and-missed.
 *
 * Returns `{ tracked: false }` when the goal shouldn't count toward the week's
 * attainment at all (no-period goal, no target, or every relevant slot off-marked).
 */
function weeklyGoalAttainment(
  goal: FocusGoal,
  sessions: any[],
  weekStart: Date,
  weekEnd: Date,
  restDays: number[]
): { tracked: boolean; met: boolean } {
  const untracked = { tracked: false, met: false };
  const period = (goal as any).activePeriod || (goal as any).period || 'daily';
  // No-period (cumulative) goals have no weekly pace — exclude from weekly coaching.
  if (period === 'none') return untracked;
  const tagId = (goal as any).tagId;

  if (period === 'weekly') {
    // The whole week is one slot — if it's off-marked, the goal sits this week out.
    if (getGoalOffKeys(goal, 'weekly').has(getPeriodKey(weekStart))) return untracked;
    const target = getTargetForDate(goal, weekStart, restDays, 'weekly');
    if (target <= 0) return untracked;
    const got = minutesInRange(sessions, weekStart, weekEnd, tagId);
    return { tracked: true, met: got >= target };
  }

  if (period === 'monthly') {
    // Attribute the week to the month its start falls in; skip if that month is off.
    const monthStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    if (getGoalOffKeys(goal, 'monthly').has(getPeriodKey(monthStart))) return untracked;
    const target = getTargetForDate(goal, weekStart, restDays, 'monthly') * (7 / 30);
    if (target <= 0) return untracked;
    const got = minutesInRange(sessions, weekStart, weekEnd, tagId);
    return { tracked: true, met: got >= target };
  }

  // daily: sum per-day target AND per-day minutes, skipping off-marked days so a
  // partially-off week is judged only on the days the user meant to show up.
  const offKeys = getGoalOffKeys(goal, 'daily');
  let target = 0;
  let got = 0;
  let anyTrackedDay = false;
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    if (offKeys.has(getPeriodKey(dayStart))) continue; // off day — as if it never existed
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const dayTarget = getTargetForDate(goal, dayStart, restDays, 'daily');
    target += dayTarget;
    got += minutesInRange(sessions, dayStart, dayEnd, tagId);
    if (dayTarget > 0) anyTrackedDay = true;
  }
  if (!anyTrackedDay || target <= 0) return untracked;
  return { tracked: true, met: got >= target };
}

/**
 * Fraction of the week [0,1] the user deliberately took off via paid Off-Marker
 * slots, unioned across active goals. A week- or month-level off-mark neutralizes
 * the whole week; daily off-marks count per day.
 *
 * Union (a day is rest if ANY active goal marked it off) is deliberate: our stance
 * is that planned rest must never lower the score, so we err toward crediting rest.
 */
function weekRestFraction(goals: FocusGoal[], weekStart: Date): number {
  const weeklyOff = goals.some(
    (g) =>
      (g as any).activePeriod === 'weekly' &&
      getGoalOffKeys(g, 'weekly').has(getPeriodKey(weekStart))
  );
  if (weeklyOff) return 1;

  const monthStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
  const monthlyOff = goals.some(
    (g) =>
      (g as any).activePeriod === 'monthly' &&
      getGoalOffKeys(g, 'monthly').has(getPeriodKey(monthStart))
  );
  if (monthlyOff) return 1;

  let restDays = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const key = getPeriodKey(d);
    if (goals.some((g) => getGoalOffKeys(g, 'daily').has(key))) restDays++;
  }
  return restDays / 7;
}

/**
 * Portion of the week the user was "available" to focus given planned rest — scales
 * the trailing-average baseline. Floored at 1/7 so a fully-off week still has one
 * comparable day (keeps volume finite; avoids divide-by-zero).
 */
export const availableWeekFraction = (restFraction: number = 0): number =>
  Math.max(1 - restFraction, 1 / 7);

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

  // Paid time off this week scales the baseline down to the days the user meant to
  // show up, so a planned-rest week reads as neutral rather than a slowdown.
  const restFraction = weekRestFraction(activeGoals, weekStart);
  const effectiveTrailingAvg = Math.round(trailingAvgMinutes * availableWeekFraction(restFraction));

  // Goal attainment for the week — Off-Marker slots are excluded (paid days/weeks
  // off don't count as tracked-and-missed), matching the streak walker.
  let goalsTracked = 0;
  let goalsMet = 0;
  activeGoals.forEach((goal) => {
    const { tracked, met } = weeklyGoalAttainment(goal, allSessions, weekStart, weekEnd, restDays);
    if (!tracked) return;
    goalsTracked++;
    if (met) goalsMet++;
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
    restFraction,
    deltaMinutesVsTrailingAvg: totalMinutes - effectiveTrailingAvg,
    byTag,
    goalsTracked,
    goalsMet,
  };
}
