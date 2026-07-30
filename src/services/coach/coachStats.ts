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
  getGoalCurrentTarget,
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

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Middle value of a list (mean of the middle two when even); 0 when empty. */
const medianOf = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/**
 * Start of the first day a goal can fairly be judged on — its creation day, or an
 * earlier `targetHistory` entry if one predates it (a goal can be re-created around
 * existing history). Days before this are skipped: a goal made on Friday shouldn't
 * begin its first week four days down.
 *
 * `-Infinity` when the goal carries no usable date, so it's judged on the whole week
 * exactly as before.
 */
function goalTrackedFromMs(goal: FocusGoal): number {
  const candidates: number[] = [];
  const created = new Date((goal as any).createdAt).getTime();
  if (Number.isFinite(created)) candidates.push(created);
  for (const entry of goal.targetHistory ?? []) {
    const t = new Date(`${entry.effectiveDate}T00:00:00`).getTime();
    if (Number.isFinite(t)) candidates.push(t);
  }
  if (candidates.length === 0) return -Infinity;
  const earliest = new Date(Math.min(...candidates));
  earliest.setHours(0, 0, 0, 0); // the whole creation day counts
  return earliest.getTime();
}

interface GoalAttainment {
  tracked: boolean;
  met: boolean;
  /** Day-hit rate [0,1] — what consistency is built from. */
  attainment: number;
  /**
   * Hours-hit rate [0,1] — what volume is built from. `null` when the goal has no
   * weekly target to measure hours against (cumulative goals), so it's left out of
   * the volume average rather than counted as a zero.
   */
  hoursAttainment: number | null;
}

/**
 * A goal's weekly attainment, honoring rest-day targets AND paid Off-Marker slots.
 * Off-marked periods are skipped entirely — as if they never existed — matching the
 * streak walker (`calculateGoalStreak`) and consistency calendar, so a week the user
 * paid fruit to take off is never counted as tracked-and-missed.
 *
 * Every goal answers two separate questions, each scoped to that goal's own targets
 * and its own off-marks — no cross-goal union, so one goal's day off never moves
 * another goal's score:
 *   - `attainment`  — did you show up on the days you meant to (days hit / days
 *     tracked). Hitting a daily target 5 of 7 days reads as 0.71, not a flat miss.
 *   - `hoursAttainment` — did you put in the hours you meant to (minutes / target).
 * `met` is the binary "did the week clear the target", used only in narration.
 *
 * Returns `{ tracked: false }` when the goal shouldn't count toward the week at all
 * (no target, every relevant slot off-marked, the goal not existing yet, or a
 * cumulative goal already achieved).
 *
 * `now` bounds the week to what has actually happened: for a week still in progress,
 * days that haven't arrived aren't misses, and whole-period targets are prorated so a
 * mid-week score reads as "on pace" rather than "behind by everything left".
 */
function weeklyGoalAttainment(
  goal: FocusGoal,
  sessions: any[],
  weekStart: Date,
  weekEnd: Date,
  restDays: number[],
  now: number
): GoalAttainment {
  const untracked = { tracked: false, met: false, attainment: 0, hoursAttainment: null };
  const period = (goal as any).activePeriod || (goal as any).period || 'daily';
  const tagId = (goal as any).tagId;
  const trackedFromMs = goalTrackedFromMs(goal);

  if (period === 'none') {
    // Cumulative (lifetime) goals have no weekly pace, so there are no hours to grade
    // and no days to hit — the only weekly question they can answer is whether the
    // user touched them at all. Already-achieved goals drop out: nothing is left to
    // show up for, so counting them as a weekly miss would be punishment for finishing.
    const lifetimeTarget = getGoalCurrentTarget(goal);
    if (lifetimeTarget <= 0) return untracked;
    const lifetimeMinutes = minutesInRange(sessions, new Date(0), weekEnd, tagId);
    if (lifetimeMinutes >= lifetimeTarget) return untracked;
    const touched = minutesInRange(sessions, weekStart, weekEnd, tagId) > 0;
    return { tracked: true, met: touched, attainment: touched ? 1 : 0, hoursAttainment: null };
  }

  // How much of the week is behind us — 1 for any completed week, so scoring a past
  // week is untouched by this.
  const elapsedFraction =
    weekEnd.getTime() <= now
      ? 1
      : clamp01((now - weekStart.getTime()) / (weekEnd.getTime() - weekStart.getTime()));

  if (period === 'weekly') {
    // The whole week is one slot — if it's off-marked, the goal sits this week out.
    if (getGoalOffKeys(goal, 'weekly').has(getPeriodKey(weekStart))) return untracked;
    // A goal born mid-week never had a full week to hit a whole-week target.
    if (trackedFromMs > weekStart.getTime()) return untracked;
    const target = getTargetForDate(goal, weekStart, restDays, 'weekly') * elapsedFraction;
    if (target <= 0) return untracked;
    const got = minutesInRange(sessions, weekStart, weekEnd, tagId);
    // A whole-week goal has no day granularity, so "days hit" and "hours hit" are the
    // same measurement here.
    const ratio = clamp01(got / target);
    return { tracked: true, met: got >= target, attainment: ratio, hoursAttainment: ratio };
  }

  if (period === 'monthly') {
    // Attribute the week to the month its start falls in; skip if that month is off.
    const monthStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1);
    if (getGoalOffKeys(goal, 'monthly').has(getPeriodKey(monthStart))) return untracked;
    if (trackedFromMs > weekStart.getTime()) return untracked;
    const target =
      getTargetForDate(goal, weekStart, restDays, 'monthly') * (7 / 30) * elapsedFraction;
    if (target <= 0) return untracked;
    const got = minutesInRange(sessions, weekStart, weekEnd, tagId);
    const ratio = clamp01(got / target);
    return { tracked: true, met: got >= target, attainment: ratio, hoursAttainment: ratio };
  }

  // daily: sum per-day target AND per-day minutes, skipping off-marked days so a
  // partially-off week is judged only on the days the user meant to show up. Days are
  // ALSO scored individually — the day-hit rate is what consistency is built from,
  // since the summed comparison alone turns any partial week into a flat miss.
  const offKeys = getGoalOffKeys(goal, 'daily');
  let target = 0;
  let got = 0;
  let daysTracked = 0;
  let daysMet = 0;
  for (let i = 0; i < 7; i++) {
    const dayStart = new Date(weekStart);
    dayStart.setDate(weekStart.getDate() + i);
    dayStart.setHours(0, 0, 0, 0);
    if (offKeys.has(getPeriodKey(dayStart))) continue; // off day — as if it never existed
    if (dayStart.getTime() < trackedFromMs) continue; // goal didn't exist yet
    if (dayStart.getTime() > now) continue; // day hasn't happened yet
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const dayTarget = getTargetForDate(goal, dayStart, restDays, 'daily');
    const dayGot = minutesInRange(sessions, dayStart, dayEnd, tagId);
    target += dayTarget;
    got += dayGot;
    // Rest days (target 0) aren't tracked days — they can't be hit or missed.
    if (dayTarget > 0) {
      daysTracked++;
      if (dayGot >= dayTarget) daysMet++;
    }
  }
  if (daysTracked === 0 || target <= 0) return untracked;
  return {
    tracked: true,
    met: got >= target,
    attainment: daysMet / daysTracked,
    hoursAttainment: clamp01(got / target),
  };
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

  // Trailing 4 weeks — only counting weeks at/after the user's first-ever session, so
  // brand-new users aren't dragged down by empty pre-history weeks.
  const firstSessionMs = allSessions.reduce(
    (min, s) => Math.min(min, new Date(s.startTime).getTime()),
    Infinity
  );
  const trailingWeekMinutes: number[] = [];
  for (let i = 1; i <= TRAILING_WEEKS; i++) {
    const ref = new Date(weekStart);
    ref.setDate(weekStart.getDate() - i * 7);
    const { periodStart, periodEnd } = getGoalPeriodRange('weekly', ref, WEEK_START_DAY);
    if (Number.isFinite(firstSessionMs) && periodEnd.getTime() < firstSessionMs) continue;
    trailingWeekMinutes.push(minutesInRange(allSessions, periodStart, periodEnd));
  }
  const trailingAvgMinutes =
    trailingWeekMinutes.length > 0
      ? Math.round(trailingWeekMinutes.reduce((a, b) => a + b, 0) / trailingWeekMinutes.length)
      : 0;
  // The user's TYPICAL week — the median, not the mean, and what volume is scored
  // against. With a mean, one exceptional week raises the bar on every week that
  // follows, so a strong week makes the next normal one read as a slump.
  const typicalWeekMinutes = Math.round(medianOf(trailingWeekMinutes));

  // Paid time off this week scales the baseline down to the days the user meant to
  // show up, so a planned-rest week reads as neutral rather than a slowdown.
  const restFraction = weekRestFraction(activeGoals, weekStart);
  const effectiveTypical = Math.round(typicalWeekMinutes * availableWeekFraction(restFraction));

  // Days the user actually planned to show up — rest days aren't absences, so they
  // must not cap the no-goals consistency fallback below 100.
  const expectedDays = Math.max(1, 7 - new Set(restDays.filter((d) => d >= 0 && d <= 6)).size);

  // Goal attainment for the week — Off-Marker slots are excluded (paid days/weeks
  // off don't count as tracked-and-missed), matching the streak walker.
  const now = Date.now();
  let goalsTracked = 0;
  let goalsMet = 0;
  let attainmentSum = 0;
  let hoursSum = 0;
  let hoursGoals = 0;
  activeGoals.forEach((goal) => {
    const { tracked, met, attainment, hoursAttainment } = weeklyGoalAttainment(
      goal,
      allSessions,
      weekStart,
      weekEnd,
      restDays,
      now
    );
    if (!tracked) return;
    goalsTracked++;
    if (met) goalsMet++;
    attainmentSum += attainment;
    if (hoursAttainment != null) {
      hoursSum += hoursAttainment;
      hoursGoals++;
    }
  });
  // Mean partial credit across tracked goals — what the consistency score reads.
  const goalAttainment = goalsTracked > 0 ? attainmentSum / goalsTracked : 0;
  // Mean hours-hit rate across goals that have a weekly target — what volume reads.
  // `null` (rather than 0) when there's nothing to measure against, so the score falls
  // through to the typical-week comparison instead of reading it as "did nothing".
  const goalHoursAttainment = hoursGoals > 0 ? hoursSum / hoursGoals : null;

  return {
    totalMinutes,
    totalSessions,
    activeDays,
    avgRating,
    ratedCount,
    peakHour,
    peakDay,
    trailingAvgMinutes,
    typicalWeekMinutes,
    expectedDays,
    restFraction,
    deltaMinutesVsTrailingAvg: totalMinutes - effectiveTypical,
    byTag,
    goalsTracked,
    goalsMet,
    goalAttainment,
    goalHoursAttainment,
  };
}
