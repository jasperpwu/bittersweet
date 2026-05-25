import { FocusGoal, FocusSession, TargetHistoryEntry } from '../store/types';

export interface GoalPeriodProgress {
  goalId: string;
  minutesCompleted: number;
  periodStart: Date;
  periodEnd: Date;
}

export const calculateGoalProgress = (
  goals: FocusGoal[],
  sessions: FocusSession[],
  tagMap?: Record<string, { id: string; name: string }>,
  weekStartDay: number = 0,
): Record<string, number> => {
  const now = new Date();
  const progress: Record<string, number> = {};

  // Ensure we have valid arrays
  if (!goals || !Array.isArray(goals)) return progress;
  if (!sessions || !Array.isArray(sessions)) return progress;

  goals.forEach(goal => {
    // Migrate legacy 'yearly' to 'monthly' at runtime
    const period = (goal.period as string) === 'yearly' ? 'monthly' : goal.period;
    const { periodStart, periodEnd } = getGoalPeriodRange(period as 'daily' | 'weekly' | 'monthly', now, weekStartDay);
    
    // Filter sessions for this goal's tags and time period
    const relevantSessions = sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      const isInPeriod = sessionDate >= periodStart && sessionDate <= periodEnd;

      // If goal has no tags, count all sessions
      const goalTagIds = (goal as any).tagIds || [];
      if (goalTagIds.length === 0) return isInPeriod;

      // Sessions store single tag in tagId, goals store tag IDs in tagIds
      const hasMatchingTag = (session as any).tagId && goalTagIds.includes((session as any).tagId);

      return isInPeriod && hasMatchingTag;
    });

    // Calculate total minutes from relevant sessions
    const totalMinutes = relevantSessions.reduce((sum, session) => {
      return sum + session.duration;
    }, 0);

    progress[goal.id] = totalMinutes;
  });

  return progress;
};

export const getGoalPeriodRange = (
  period: 'daily' | 'weekly' | 'monthly',
  referenceDate: Date = new Date(),
  weekStartDay: number = 0,
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
  weekStartDay: number = 0,
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

export const isGoalActive = (goal: FocusGoal): boolean => {
  return goal.isActive;
};

export const getActiveGoals = (goals: FocusGoal[]): FocusGoal[] => {
  return goals.filter(isGoalActive);
};

export const shouldResetGoalProgress = (
  goal: FocusGoal,
  currentDate: Date = new Date(),
  weekStartDay: number = 0,
): boolean => {
  const period = goal.period === ('yearly' as string) ? 'monthly' : goal.period;
  const { periodStart } = getGoalPeriodRange(period as 'daily' | 'weekly' | 'monthly', currentDate, weekStartDay);
  return new Date(goal.lastResetDate) < periodStart;
};

/**
 * Returns whether the given date falls on a rest day.
 */
export const isRestDay = (date: Date, restDays: number[]): boolean => {
  return restDays.includes(date.getDay());
};

/**
 * Looks up the correct target from a goal's targetHistory for the given date.
 * Uses the historical restDays snapshot from the entry (not the current preference)
 * so that past targets are never affected by preference changes.
 * The `currentRestDays` param is only used as a fallback when no history exists.
 * Only applies rest day logic to daily goals.
 */
export const getTargetForDate = (
  goal: FocusGoal,
  date: Date,
  currentRestDays: number[],
): number => {
  const history = goal.targetHistory;
  const dateStr = date.toISOString().split('T')[0];

  // Default to current goal values if no history
  if (!history || history.length === 0) {
    if (goal.period === 'daily' && isRestDay(date, currentRestDays)) {
      return goal.restDayTargetMinutes ?? goal.targetMinutes;
    }
    return goal.targetMinutes;
  }

  // Find the applicable history entry (last entry with effectiveDate <= dateStr)
  let applicable: TargetHistoryEntry = history[0];
  for (const entry of history) {
    if (entry.effectiveDate <= dateStr) {
      applicable = entry;
    } else {
      break; // history is sorted ascending
    }
  }

  // Use the rest days snapshot from the history entry itself
  const historicalRestDays = applicable.restDays ?? currentRestDays;
  if (goal.period === 'daily' && isRestDay(date, historicalRestDays)) {
    return applicable.restDayTargetMinutes;
  }
  return applicable.targetMinutes;
};