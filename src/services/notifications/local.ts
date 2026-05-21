import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusGoal, FocusSession } from '../../store/types';
import { calculateGoalProgress, getGoalPeriodRange } from '../../utils/goalProgress';
import { calculateUrgency } from '../../utils/goalUrgency';

const GOAL_NUDGE_IDS_KEY = 'goal-nudge-notification-ids';

const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const getRemainingDays = (goal: FocusGoal): number => {
  const now = new Date();
  const period = (goal.period as string) === 'yearly' ? 'monthly' : goal.period;
  const { periodEnd } = getGoalPeriodRange(period as 'daily' | 'weekly' | 'monthly', now);
  const msRemaining = periodEnd.getTime() - now.getTime();
  return Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
};

export const cancelAllGoalNudges = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(GOAL_NUDGE_IDS_KEY);
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      await Promise.all(
        ids.map(id => Notifications.cancelScheduledNotificationAsync(id)),
      );
    }
    await AsyncStorage.removeItem(GOAL_NUDGE_IDS_KEY);
  } catch (error) {
    console.error('Failed to cancel goal nudges:', error);
  }
};

export const scheduleGoalNudges = async (
  goals: FocusGoal[],
  sessions: FocusSession[],
  tagMap: Record<string, { id: string; name: string }>,
  reminderTime: string, // "HH:MM"
  soundEnabled: boolean,
): Promise<void> => {
  // Cancel previous nudges first
  await cancelAllGoalNudges();

  if (!goals || goals.length === 0) return;

  // Calculate current progress for all goals
  const progress = calculateGoalProgress(goals, sessions, tagMap);

  // Compute urgency for each active goal, filter to behind-pace
  const behindGoals = goals
    .filter(g => g.isActive)
    .map(g => ({
      goal: g,
      urgency: calculateUrgency(g, progress[g.id] || 0),
      currentProgress: progress[g.id] || 0,
    }))
    .filter(item => item.urgency.isBehindPace)
    .sort((a, b) => b.urgency.score - a.urgency.score);

  if (behindGoals.length === 0) return;

  // Build notification content
  const mostUrgent = behindGoals[0];
  const deficit = mostUrgent.goal.targetMinutes - mostUrgent.currentProgress;
  const remainingDays = getRemainingDays(mostUrgent.goal);

  let title: string;
  let body: string;

  if (behindGoals.length === 1) {
    title = mostUrgent.goal.name;
    body = `${formatMinutes(deficit)} left — ${remainingDays} day${remainingDays !== 1 ? 's' : ''} remaining`;
  } else {
    title = `${behindGoals.length} goals need attention`;
    body = `${mostUrgent.goal.name}: ${formatMinutes(deficit)} left — ${remainingDays} day${remainingDays !== 1 ? 's' : ''} remaining`;
  }

  // Parse reminder time
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const now = new Date();
  const triggerDate = new Date(now);
  triggerDate.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (triggerDate <= now) {
    triggerDate.setDate(triggerDate.getDate() + 1);
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: soundEnabled,
        data: { type: 'goal-nudge' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    await AsyncStorage.setItem(
      GOAL_NUDGE_IDS_KEY,
      JSON.stringify([notificationId]),
    );
  } catch (error) {
    console.error('Failed to schedule goal nudge:', error);
  }
};
