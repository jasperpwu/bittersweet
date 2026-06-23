import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Weekly "your week in focus is ready" nudge for the AI Focus Coach.
 * Mirrors the goal-nudge service: serialized cancel-then-schedule with AsyncStorage
 * id tracking. Uses a one-shot DATE trigger for the upcoming Monday and is
 * re-scheduled on every foreground, so the caller (useWeeklyCoach) can decide each
 * time whether the user has a report worth nudging about.
 */

const COACH_NUDGE_ID_KEY = 'weekly-coach-notification-ids';
export const COACH_NUDGE_NOTIFICATION_TYPE = 'weekly-coach';

const NUDGE_HOUR = 9;
const NUDGE_MINUTE = 0;

// Monday 09:00 — the morning after a Mon–Sun week completes. Today if it's Monday
// before 9am, otherwise the next Monday.
const nextNudgeDate = (): Date => {
  const now = new Date();
  const target = new Date(now);
  target.setHours(NUDGE_HOUR, NUDGE_MINUTE, 0, 0);
  let daysUntilMonday = (1 - target.getDay() + 7) % 7; // 0 when today is Monday
  if (daysUntilMonday === 0 && now.getTime() >= target.getTime()) daysUntilMonday = 7;
  target.setDate(target.getDate() + daysUntilMonday);
  return target;
};

let operationQueue: Promise<void> = Promise.resolve();
const enqueueOperation = (operation: () => Promise<void>): Promise<void> => {
  const queued = operationQueue.then(operation, operation);
  operationQueue = queued.catch(() => undefined);
  return queued;
};

const cancelInternal = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(COACH_NUDGE_ID_KEY);
    const ids = new Set<string>();
    if (raw) (JSON.parse(raw) as string[]).forEach((id) => ids.add(id));

    // Also catch any orphaned coach nudges the system still has scheduled.
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    scheduled.forEach((n) => {
      if (n.content.data?.type === COACH_NUDGE_NOTIFICATION_TYPE) ids.add(n.identifier);
    });

    await Promise.all(
      Array.from(ids).map((id) => Notifications.cancelScheduledNotificationAsync(id))
    );
    await AsyncStorage.removeItem(COACH_NUDGE_ID_KEY);
  } catch (error) {
    console.error('Failed to cancel coach nudge:', error);
  }
};

const scheduleInternal = async (soundEnabled: boolean): Promise<void> => {
  await cancelInternal();
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your week in focus is ready',
        body: "See this week's focus score and what your coach suggests.",
        sound: soundEnabled,
        data: { type: COACH_NUDGE_NOTIFICATION_TYPE },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nextNudgeDate(),
      },
    });
    await AsyncStorage.setItem(COACH_NUDGE_ID_KEY, JSON.stringify([id]));
  } catch (error) {
    console.error('Failed to schedule coach nudge:', error);
  }
};

export const scheduleWeeklyCoachNudge = (soundEnabled: boolean): Promise<void> =>
  enqueueOperation(() => scheduleInternal(soundEnabled));

export const cancelWeeklyCoachNudge = (): Promise<void> => enqueueOperation(cancelInternal);
