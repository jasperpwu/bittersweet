import { FocusGoal, FocusSession } from '../store/types';

export interface GoalPeriodProgress {
  goalId: string;
  minutesCompleted: number;
  periodStart: Date;
  periodEnd: Date;
}

export const calculateGoalProgress = (
  goals: FocusGoal[],
  sessions: FocusSession[],
  tagMap?: Record<string, { id: string; name: string }>
): Record<string, number> => {
  const now = new Date();
  const progress: Record<string, number> = {};

  // Ensure we have valid arrays
  if (!goals || !Array.isArray(goals)) return progress;
  if (!sessions || !Array.isArray(sessions)) return progress;

  goals.forEach(goal => {
    // Migrate legacy 'yearly' to 'monthly' at runtime
    const period = (goal.period as string) === 'yearly' ? 'monthly' : goal.period;
    const { periodStart, periodEnd } = getGoalPeriodRange(period as 'daily' | 'weekly' | 'monthly', now);
    
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
  referenceDate: Date = new Date()
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
      const periodStart = new Date(now);
      // Start of week (Sunday = 0)
      periodStart.setDate(now.getDate() - dayOfWeek);
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
  referenceDate: Date = new Date()
): { periodStart: Date; periodEnd: Date; label: string }[] => {
  const ranges: { periodStart: Date; periodEnd: Date; label: string }[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const ref = new Date(referenceDate);

    switch (period) {
      case 'daily': {
        ref.setDate(ref.getDate() - i);
        const { periodStart, periodEnd } = getGoalPeriodRange('daily', ref);
        ranges.push({
          periodStart,
          periodEnd,
          label: ref.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        });
        break;
      }
      case 'weekly': {
        ref.setDate(ref.getDate() - i * 7);
        const { periodStart, periodEnd } = getGoalPeriodRange('weekly', ref);
        ranges.push({
          periodStart,
          periodEnd,
          label: `W${count - i}`,
        });
        break;
      }
      case 'monthly': {
        ref.setMonth(ref.getMonth() - i);
        const { periodStart, periodEnd } = getGoalPeriodRange('monthly', ref);
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
  currentDate: Date = new Date()
): boolean => {
  const period = goal.period === ('yearly' as string) ? 'monthly' : goal.period;
  const { periodStart } = getGoalPeriodRange(period as 'daily' | 'weekly' | 'monthly', currentDate);
  return new Date(goal.lastResetDate) < periodStart;
};