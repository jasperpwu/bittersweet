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
    const { periodStart, periodEnd } = getGoalPeriodRange(goal.period, now);
    
    // Filter sessions for this goal's tags and time period
    const relevantSessions = sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      const isInPeriod = sessionDate >= periodStart && sessionDate <= periodEnd;
      
      // If goal has no tags, count all sessions
      if (goal.tagIds.length === 0) return isInPeriod;
      
      // Handle tag name/ID mismatch
      // Sessions store single tag ID in tagId, goals store tag IDs in tagIds
      const hasMatchingTag = session.tagId && goal.tagIds.includes(session.tagId);
      
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
  period: 'daily' | 'weekly' | 'yearly',
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
    
    case 'yearly': {
      const periodStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      const periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      
      return { periodStart, periodEnd };
    }
    
    default:
      throw new Error(`Unsupported period: ${period}`);
  }
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
  const { periodStart } = getGoalPeriodRange(goal.period, currentDate);
  return new Date(goal.lastResetDate) < periodStart;
};