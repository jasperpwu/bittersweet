import { FocusGoal, Badge } from '../store/types';
import { getGoalPeriodRange, getTargetForDate, getSessionMinutesInPeriod } from './goalProgress';

/**
 * Computes badge stats from a goal's history and associated sessions.
 */
export function computeBadgeStats(
  goal: FocusGoal,
  sessions: any[],
  tag: { icon: string; name: string; color?: string },
  weekStartDay: number = 0,
  restDays: number[] = [0, 6],
): Omit<Badge, 'id' | 'createdAt' | 'updatedAt'> {
  // Filter sessions for this goal's tag
  const tagSessions = sessions.filter(s => {
    if (goal.tagId) {
      return s.tagId === goal.tagId;
    }
    const legacyIds = (goal as any).tagIds || [];
    return legacyIds.includes(s.tagId);
  });

  const totalMinutes = tagSessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalSessions = tagSessions.length;

  const goalName = goal.customName || `${tag.icon} ${tag.name} Goal`;

  // Compute per-period stats
  const dailyStats = computePeriodStats(goal, tagSessions, 'daily', weekStartDay, restDays);
  const weeklyStats = computePeriodStats(goal, tagSessions, 'weekly', weekStartDay, restDays);
  const monthlyStats = computePeriodStats(goal, tagSessions, 'monthly', weekStartDay, restDays);

  // Duration distribution
  const durations = tagSessions.map((s: any) => s.duration || 0);
  const avgMinutesPerSession = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
  const shortestSession = durations.length > 0 ? durations.reduce((a, b) => a < b ? a : b) : 0;
  const longestSession = durations.length > 0 ? durations.reduce((a, b) => a > b ? a : b) : 0;

  // Peak hour
  const hourCounts: Record<number, number> = {};
  const dayCounts: Record<number, number> = {};
  tagSessions.forEach((s: any) => {
    const d = new Date(s.startTime);
    const hour = d.getHours();
    const day = d.getDay();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  const peakHour = Object.entries(hourCounts).reduce<[string, number]>(
    (a, b) => (b[1] > a[1] ? b : a),
    ['0', 0]
  );
  const peakDay = Object.entries(dayCounts).reduce<[string, number]>(
    (a, b) => (b[1] > a[1] ? b : a),
    ['0', 0]
  );
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Notes
  const sessionsWithNotes = tagSessions.filter((s: any) => s.notes);
  const notesCount = sessionsWithNotes.length;
  const recentNotes = sessionsWithNotes.slice(-5).map((s: any) => s.notes);

  // Dates
  const startDate = tagSessions.length > 0
    ? new Date(tagSessions.reduce((min: number, s: any) => {
        const t = new Date(s.startTime).getTime();
        return t < min ? t : min;
      }, Infinity)).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];

  return {
    tagIcon: tag.icon,
    tagName: tag.name,
    tagColor: tag.color || '#6592E9',
    goalName,
    totalMinutes,
    totalSessions,
    dailyStats: dailyStats.totalPeriods > 0 ? dailyStats : undefined,
    weeklyStats: weeklyStats.totalPeriods > 0 ? weeklyStats : undefined,
    monthlyStats: monthlyStats.totalPeriods > 0 ? monthlyStats : undefined,
    durationDistribution: {
      avgMinutesPerSession,
      shortestSession,
      longestSession,
      peakHour: parseInt(peakHour[0]),
      peakDay: dayNames[parseInt(peakDay[0])] || '',
    },
    notesCount,
    recentNotes,
    startDate,
    endDate,
  };
}

function computePeriodStats(
  goal: FocusGoal,
  sessions: any[],
  period: 'daily' | 'weekly' | 'monthly',
  weekStartDay: number,
  restDays: number[],
): { longestStreak: number; periodsGoalMet: number; totalPeriods: number } {
  // Check if goal has any history entries for this period
  const periodHistory = (goal.targetHistory || []).filter((e: any) => e.period === period);
  if (periodHistory.length === 0) {
    return { longestStreak: 0, periodsGoalMet: 0, totalPeriods: 0 };
  }

  // Determine start date from first history entry for this period
  const firstEntry = periodHistory[0];
  const startDate = new Date(firstEntry.effectiveDate);
  const now = new Date();

  // Generate period ranges from start to now
  const ranges: { periodStart: Date; periodEnd: Date }[] = [];
  let ref = new Date(startDate);

  while (ref <= now) {
    const range = getGoalPeriodRange(period, ref, weekStartDay);
    ranges.push(range);

    // Advance to next period
    if (period === 'daily') {
      ref.setDate(ref.getDate() + 1);
    } else if (period === 'weekly') {
      ref.setDate(ref.getDate() + 7);
    } else {
      ref.setMonth(ref.getMonth() + 1);
    }
  }

  let longestStreak = 0;
  let currentStreak = 0;
  let periodsGoalMet = 0;

  for (const range of ranges) {
    const target = getTargetForDate(goal, range.periodStart, restDays, period);
    if (target <= 0) continue;

    const totalMinutes = sessions.reduce((sum: number, s: any) => {
      return sum + getSessionMinutesInPeriod(s, range.periodStart, range.periodEnd);
    }, 0);

    if (totalMinutes >= target) {
      periodsGoalMet++;
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return { longestStreak, periodsGoalMet, totalPeriods: ranges.length };
}
