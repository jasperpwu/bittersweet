import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FocusGoal, FocusSession } from '../../store/types';
import { calculateGoalProgress } from '../../utils/goalProgress';
import { calculateUrgency } from '../../utils/goalUrgency';

const GOAL_NUDGE_IDS_KEY = 'goal-nudge-notification-ids';
const GOAL_NUDGE_NOTIFICATION_ID = 'goal-nudge-daily-reminder';
const GOAL_NUDGE_NOTIFICATION_TYPE = 'goal-nudge';

let goalNudgeOperationQueue: Promise<void> = Promise.resolve();

const getGoalDisplayName = (goal: FocusGoal): string => {
  return (goal as any).customName || (goal as any).name || 'Goal';
};

const enqueueGoalNudgeOperation = (operation: () => Promise<void>): Promise<void> => {
  const queuedOperation = goalNudgeOperationQueue.then(operation, operation);
  goalNudgeOperationQueue = queuedOperation.catch(() => undefined);
  return queuedOperation;
};

const cancelPendingGoalNudges = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(GOAL_NUDGE_IDS_KEY);
    const storedIds = new Set<string>([GOAL_NUDGE_NOTIFICATION_ID]);

    if (raw) {
      const ids: string[] = JSON.parse(raw);
      ids.forEach(id => storedIds.add(id));
    }

    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    scheduledNotifications.forEach(notification => {
      if (
        notification.content.data?.type === GOAL_NUDGE_NOTIFICATION_TYPE ||
        storedIds.has(notification.identifier)
      ) {
        storedIds.add(notification.identifier);
      }
    });

    await Promise.all(
      Array.from(storedIds).map(id => Notifications.cancelScheduledNotificationAsync(id)),
    );
    await AsyncStorage.removeItem(GOAL_NUDGE_IDS_KEY);
  } catch (error) {
    console.error('Failed to cancel goal nudges:', error);
  }
};

export const cancelAllGoalNudges = (): Promise<void> => {
  return enqueueGoalNudgeOperation(cancelPendingGoalNudges);
};

const scheduleGoalNudgesInternal = async (
  goals: FocusGoal[],
  sessions: FocusSession[],
  tagMap: Record<string, { id: string; name: string }>,
  reminderTime: string, // "HH:MM"
  soundEnabled: boolean,
): Promise<void> => {
  // Cancel previous nudges first
  await cancelPendingGoalNudges();

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
      identifier: GOAL_NUDGE_NOTIFICATION_ID,
      content: {
        title,
        body,
        sound: soundEnabled,
        data: { type: GOAL_NUDGE_NOTIFICATION_TYPE },
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

export const scheduleGoalNudges = (
  goals: FocusGoal[],
  sessions: FocusSession[],
  tagMap: Record<string, { id: string; name: string }>,
  reminderTime: string,
  soundEnabled: boolean,
): Promise<void> => {
  return enqueueGoalNudgeOperation(() =>
    scheduleGoalNudgesInternal(goals, sessions, tagMap, reminderTime, soundEnabled),
  );
};
