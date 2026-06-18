import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusGoal, FocusSession } from '../../store/types';
import { calculateGoalProgress } from '../../utils/goalProgress';
import { calculateUrgency } from '../../utils/goalUrgency';

const GOAL_NUDGE_IDS_KEY = 'goal-nudge-notification-ids';

const getGoalDisplayName = (goal: FocusGoal): string => {
  return (goal as any).customName || (goal as any).name || 'Goal';
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

  // Build notification content — list the tags that need attention (sorted by urgency)
  const tagNames = behindGoals.map(
    item => tagMap[item.goal.tagId]?.name || getGoalDisplayName(item.goal),
  );

  const title =
    tagNames.length === 1
      ? 'Goal needs attention'
      : `${tagNames.length} goals need attention`;
  const body = tagNames.join(', ');

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
