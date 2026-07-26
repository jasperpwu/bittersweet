import { FocusGoal, FocusSession, TargetHistoryEntry } from '../store/types';

// Fruit cost of marking one slot off, per period type (Off-Marker store item).
export const OFF_MARK_COSTS: Record<'daily' | 'weekly' | 'monthly', number> = {
  daily: 20,
  weekly: 50,
  monthly: 100,
};

// Canonical key for an off-mark: the local-calendar START of the slot, "YYYY-MM-DD".
// Derived from the same periodStart the streak walker and calendar compute, so
// membership checks line up cell-for-cell with the consistency calendar.
export const getPeriodKey = (periodStart: Date): string => {
  const y = periodStart.getFullYear();
  const m = String(periodStart.getMonth() + 1).padStart(2, '0');
  const d = String(periodStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// The set of off-marked slot keys for a goal at a given period type. Missing
// goal.offMarks (older goals) yields an empty set.
export const getGoalOffKeys = (
  goal: FocusGoal,
  period: 'daily' | 'weekly' | 'monthly'
): Set<string> => new Set(goal.offMarks?.[period] ?? []);

export interface GoalPeriodProgress {
  goalId: string;
  minutesCompleted: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Calculates how many minutes of a session fall within a given period.
 * For sessions that cross period boundaries (e.g. midnight), this returns
 * only the proportional duration that overlaps with the period.
 */
export const getSessionMinutesInPeriod = (
  session: FocusSession,
  periodStart: Date,
  periodEnd: Date
): number => {
  const sessionStart = new Date(session.startTime).getTime();

  // If no endTime, fall back to startTime-based attribution
  if (!session.endTime) {
    const isInPeriod = sessionStart >= periodStart.getTime() && sessionStart <= periodEnd.getTime();
    return isInPeriod ? session.duration : 0;
  }

  const sessionEnd = new Date(session.endTime).getTime();

  // No overlap
  if (sessionEnd <= periodStart.getTime() || sessionStart >= periodEnd.getTime()) {
    return 0;
  }

  const totalWallTime = sessionEnd - sessionStart;

  // Session fits entirely within period, or wall time is zero/negative
  if (
    totalWallTime <= 0 ||
    (sessionStart >= periodStart.getTime() && sessionEnd <= periodEnd.getTime())
  ) {
    return session.duration;
  }

  // Calculate overlapping wall-clock time and proportionally split duration
  const overlapStart = Math.max(sessionStart, periodStart.getTime());
  const overlapEnd = Math.min(sessionEnd, periodEnd.getTime());
  const overlapTime = overlapEnd - overlapStart;
  const fraction = overlapTime / totalWallTime;

  return session.duration * fraction;
};

export const calculateGoalProgress = (
  goals: FocusGoal[],
  sessions: FocusSession[],
  _tagMap?: Record<string, { id: string; name: string }>,
  weekStartDay: number = 1
): Record<string, number> => {
  const now = new Date();
  const progress: Record<string, number> = {};

  // Ensure we have valid arrays
  if (!goals || !Array.isArray(goals)) return progress;
  if (!sessions || !Array.isArray(sessions)) return progress;

  goals.forEach((goal) => {
    // Use activePeriod (new model) with fallback to period (legacy)
    const period = (goal as any).activePeriod || (goal as any).period || 'daily';

    // No-period (cumulative) goals count every matching session for all time —
    // there is no period range and progress never resets.
    const isNoPeriod = period === 'none';
    const normalizedPeriod = period === 'yearly' ? 'monthly' : period;
    const { periodStart, periodEnd } = isNoPeriod
      ? { periodStart: new Date(0), periodEnd: new Date(8640000000000000) }
      : getGoalPeriodRange(normalizedPeriod as 'daily' | 'weekly' | 'monthly', now, weekStartDay);

    // Calculate total minutes from sessions that overlap with this period
    const totalMinutes = sessions.reduce((sum, session) => {
      // Tag filter (new model: tagId). A session counts toward the goal if either
      // its primary OR secondary tag matches — dual-tagged sessions credit both.
      if (goal.tagId) {
        const matches =
          (session as any).tagId === goal.tagId || (session as any).secondaryTagId === goal.tagId;
        if (!matches) return sum;
      } else {
        // Legacy fallback: tagIds array
        const goalTagIds = (goal as any).tagIds || [];
        if (goalTagIds.length > 0) {
          const hasMatchingTag =
            ((session as any).tagId && goalTagIds.includes((session as any).tagId)) ||
            ((session as any).secondaryTagId &&
              goalTagIds.includes((session as any).secondaryTagId));
          if (!hasMatchingTag) return sum;
        }
      }

      return sum + getSessionMinutesInPeriod(session, periodStart, periodEnd);
    }, 0);

    progress[goal.id] = totalMinutes;
  });

  return progress;
};

export const getGoalPeriodRange = (
  period: 'daily' | 'weekly' | 'monthly',
  referenceDate: Date = new Date(),
  weekStartDay: number = 1
): { periodStart: Date; periodEnd: Date } => {
  const now = new Date(referenceDate);

  switch (period) {
    case 'daily': {
      const periodStart = new Date(now);
      periodStart.setHours(0, 0, 0, 0);

      const periodEnd = new Date(now);
      periodEnd.setHours(23, 59, 59, 999);

      return { periodStart, periodEnd };
    }

    case 'weekly': {
      const dayOfWeek = now.getDay();
      const diff = (dayOfWeek - weekStartDay + 7) % 7;
      const periodStart = new Date(now);
      periodStart.setDate(now.getDate() - diff);
      periodStart.setHours(0, 0, 0, 0);

      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodStart.getDate() + 6);
      periodEnd.setHours(23, 59, 59, 999);

      return { periodStart, periodEnd };
    }

    case 'monthly': {
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      return { periodStart, periodEnd };
    }

    default:
      throw new Error(`Unsupported period: ${period}`);
  }
};

/**
 * Returns past N period ranges for consistency tracking on repeating goals.
 * Ranges are returned in chronological order (oldest first).
 */
export const getHistoricalPeriodRanges = (
  period: 'daily' | 'weekly' | 'monthly',
  count: number,
  referenceDate: Date = new Date(),
  weekStartDay: number = 1
): { periodStart: Date; periodEnd: Date; label: string }[] => {
  const ranges: { periodStart: Date; periodEnd: Date; label: string }[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const ref = new Date(referenceDate);

    switch (period) {
      case 'daily': {
        ref.setDate(ref.getDate() - i);
        const { periodStart, periodEnd } = getGoalPeriodRange('daily', ref, weekStartDay);
        ranges.push({
          periodStart,
          periodEnd,
          label: ref.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        });
        break;
      }
      case 'weekly': {
        ref.setDate(ref.getDate() - i * 7);
        const { periodStart, periodEnd } = getGoalPeriodRange('weekly', ref, weekStartDay);
        ranges.push({
          periodStart,
          periodEnd,
          label: `W${count - i}`,
        });
        break;
      }
      case 'monthly': {
        ref.setMonth(ref.getMonth() - i);
        const { periodStart, periodEnd } = getGoalPeriodRange('monthly', ref, weekStartDay);
        ranges.push({
          periodStart,
          periodEnd,
          label: ref.toLocaleDateString('en-US', { month: 'short' }),
        });
        break;
      }
    }
  }

  return ranges;
};

/**
 * Counts how many consecutive most-recent periods (ending at `referenceDate`'s
 * period) hit the goal's target — the goal's "streak". Uses the same per-period
 * hit definition as the consistency calendar (`getTargetForDate` +
 * `getSessionMinutesInPeriod`), so the number always agrees with the green
 * checkmark cells. Walking backward from the current period, it stops at the
 * first period that did not hit. Rest-day periods with a 0 target count as hits
 * (they never break the streak), matching the calendar.
 *
 * The streak is UNBOUNDED — a 400-day run counts 400. The only limit is the
 * user's own history, since a streak cannot begin before their first session.
 * (This previously stopped at a fixed 365/104/36 periods, which silently clipped
 * the longest streaks — the ones that matter most.)
 */
export const calculateGoalStreak = (
  goal: FocusGoal,
  sessions: FocusSession[],
  restDays: number[],
  weekStartDay: number = 1,
  referenceDate: Date = new Date()
): number => {
  const period = (goal as any).activePeriod || (goal as any).period || 'daily';
  // No-period (cumulative) goals have no concept of a per-period streak.
  if (period === 'none') return 0;
  const normalized = (period === 'yearly' ? 'monthly' : period) as 'daily' | 'weekly' | 'monthly';

  const goalTagId = (goal as any).tagId;
  const relevant = goalTagId
    ? sessions.filter(
        (s) => (s as any).tagId === goalTagId || (s as any).secondaryTagId === goalTagId
      )
    : sessions;
  if (relevant.length === 0) return 0;

  // Index every session under the period(s) it touches, in one pass, so the walk
  // below reads O(1) per period. Without this the walk rescans all sessions for
  // every period — O(periods × sessions) — which made an unbounded walk get
  // slower the longer a user's streak grew, exactly the wrong way round.
  const byPeriod = new Map<string, FocusSession[]>();
  let earliest = Infinity;
  for (const s of relevant) {
    const startTime = new Date(s.startTime).getTime();
    if (!Number.isFinite(startTime)) continue;
    if (startTime < earliest) earliest = startTime;

    // A session can straddle a boundary (a run past midnight), so index it under
    // each period it overlaps; getSessionMinutesInPeriod splits the minutes.
    // Bad/corrupt endTimes collapse to a single period rather than looping.
    const rawEnd = s.endTime ? new Date(s.endTime).getTime() : startTime;
    const endTime = Number.isFinite(rawEnd) && rawEnd > startTime ? rawEnd : startTime;

    let cursor = new Date(startTime);
    for (;;) {
      const { periodStart, periodEnd } = getGoalPeriodRange(normalized, cursor, weekStartDay);
      const key = getPeriodKey(periodStart);
      const bucket = byPeriod.get(key);
      if (bucket) bucket.push(s);
      else byPeriod.set(key, [s]);
      if (periodEnd.getTime() >= endTime) break;
      cursor = new Date(periodEnd.getTime() + 1);
    }
  }
  if (!Number.isFinite(earliest)) return 0;

  // Off-marked slots are skipped entirely — they neither extend nor break the
  // streak, as if the period never existed.
  const offKeys = getGoalOffKeys(goal, normalized);

  const now = referenceDate.getTime();

  let streak = 0;
  let cursor = new Date(referenceDate);
  // Walk backward from the current period until we pass the first session.
  for (;;) {
    const { periodStart, periodEnd } = getGoalPeriodRange(normalized, cursor, weekStartDay);
    if (periodEnd.getTime() < earliest) break;

    const key = getPeriodKey(periodStart);
    if (!offKeys.has(key)) {
      const inPeriod = byPeriod.get(key) ?? [];
      const totalMinutes = inPeriod.reduce(
        (sum, s) => sum + getSessionMinutesInPeriod(s, periodStart, periodEnd),
        0
      );
      const target = getTargetForDate(goal, periodStart, restDays, normalized);
      const hit = target > 0 ? totalMinutes >= target : true;
      if (hit) {
        streak++;
      } else if (periodEnd.getTime() < now) {
        // A past period that missed ends the streak. The CURRENT period is
        // exempt: not having hit it *yet* isn't a miss, so it neither counts
        // nor breaks.
        break;
      }
    }

    // One millisecond before this period's start always lands in the previous
    // period — proof against DST shifts and uneven month lengths, unlike
    // subtracting a fixed number of days.
    cursor = new Date(periodStart.getTime() - 1);
  }

  return streak;
};

export const isGoalActive = (goal: FocusGoal): boolean => {
  return goal.isActive;
};

export const getActiveGoals = (goals: FocusGoal[]): FocusGoal[] => {
  return goals.filter(isGoalActive);
};

export const shouldResetGoalProgress = (
  goal: FocusGoal,
  currentDate: Date = new Date(),
  weekStartDay: number = 1
): boolean => {
  const period = (goal as any).activePeriod || (goal as any).period || 'daily';
  // No-period (cumulative) goals never reset.
  if (period === 'none') return false;
  const normalizedPeriod = period === 'yearly' ? 'monthly' : period;
  const { periodStart } = getGoalPeriodRange(
    normalizedPeriod as 'daily' | 'weekly' | 'monthly',
    currentDate,
    weekStartDay
  );
  return new Date(goal.lastResetDate) < periodStart;
};

/**
 * Returns whether the given date falls on a rest day.
 */
export const isRestDay = (date: Date, restDays: number[]): boolean => {
  return restDays.includes(date.getDay());
};

/**
 * Helper to get the current target minutes from a goal based on its activePeriod.
 * Falls back to legacy targetMinutes if per-period fields aren't set.
 */
export const getGoalCurrentTarget = (goal: FocusGoal): number => {
  const period = (goal as any).activePeriod || (goal as any).period || 'daily';
  if (period === 'daily') return goal.dailyTargetMinutes || (goal as any).targetMinutes || 0;
  if (period === 'weekly') return goal.weeklyTargetMinutes || (goal as any).targetMinutes || 0;
  if (period === 'monthly') return goal.monthlyTargetMinutes || (goal as any).targetMinutes || 0;
  if (period === 'none') return goal.totalTargetMinutes || 0;
  return (goal as any).targetMinutes || 0;
};

/**
 * Looks up the correct target from a goal's targetHistory for the given date.
 * Uses the historical restDays snapshot from the entry (not the current preference)
 * so that past targets are never affected by preference changes.
 * The `currentRestDays` param is only used as a fallback when no history exists.
 * Only applies rest day logic to daily goals.
 * The optional `period` parameter allows looking up a specific period's target;
 * defaults to the goal's activePeriod.
 */
export const getTargetForDate = (
  goal: FocusGoal,
  date: Date,
  currentRestDays: number[],
  period?: 'daily' | 'weekly' | 'monthly'
): number => {
  const goalPeriod = period || (goal as any).activePeriod || (goal as any).period || 'daily';
  // No-period (cumulative) goals have a single flat target — no rest days, no history.
  if (goalPeriod === 'none') return getGoalCurrentTarget(goal);
  const normalizedPeriod = goalPeriod === 'yearly' ? 'monthly' : goalPeriod;
  const history = goal.targetHistory;
  const dateStr = date.toISOString().split('T')[0];

  // Default to current goal values if no history
  if (!history || history.length === 0) {
    const currentTarget = getGoalCurrentTarget(goal);
    if (normalizedPeriod === 'daily' && isRestDay(date, currentRestDays)) {
      return goal.dailyRestDayTargetMinutes ?? (goal as any).restDayTargetMinutes ?? currentTarget;
    }
    return currentTarget;
  }

  // Filter history by period if entries have the period field
  const periodHistory = history.filter((e: any) => !e.period || e.period === normalizedPeriod);
  const searchHistory = periodHistory.length > 0 ? periodHistory : history;

  // Find the applicable history entry (last entry with effectiveDate <= dateStr)
  let applicable: TargetHistoryEntry = searchHistory[0];
  for (const entry of searchHistory) {
    if (entry.effectiveDate <= dateStr) {
      applicable = entry;
    } else {
      break; // history is sorted ascending
    }
  }

  // Use the rest days snapshot from the history entry itself
  const historicalRestDays = applicable.restDays ?? currentRestDays;
  if (normalizedPeriod === 'daily' && isRestDay(date, historicalRestDays)) {
    return applicable.restDayTargetMinutes;
  }
  return applicable.targetMinutes;
};
