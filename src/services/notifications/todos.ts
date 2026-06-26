import * as Notifications from 'expo-notifications';
import i18n from '../../i18n';
import type { Todo } from '../../store/types';

// One local notification per open todo with a future start, keyed deterministically
// off the todo id so reconciliation is idempotent.
const TODO_NOTIFICATION_TYPE = 'todo-start';
const idFor = (todoId: string) => `todo-start-${todoId}`;

// Date-only todos (no explicit start time) fire at this hour on the start date.
const DEFAULT_DATE_ONLY_HOUR = 9; // 9:00 AM

// Serialize all scheduling work so a burst of todo edits can't interleave a
// cancel with a reschedule (mirrors the goal-nudge queue).
let operationQueue: Promise<void> = Promise.resolve();
const enqueue = (operation: () => Promise<void>): Promise<void> => {
  const queued = operationQueue.then(operation, operation);
  operationQueue = queued.catch(() => undefined);
  return queued;
};

// The moment a todo's reminder should fire, or null when it shouldn't have one:
// completed, deleted, no start, or a start that has already passed.
const fireDateFor = (todo: Todo): Date | null => {
  if (!todo.startAt || todo.completed || todo.deletedAt) return null;
  const fire = new Date(todo.startAt);
  if (!todo.startHasTime) fire.setHours(DEFAULT_DATE_ONLY_HOUR, 0, 0, 0);
  if (fire.getTime() <= Date.now()) return null;
  return fire;
};

const cancelOurs = async (): Promise<void> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.type === TODO_NOTIFICATION_TYPE)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
};

const reconcileInternal = async (todos: Todo[], soundEnabled: boolean): Promise<void> => {
  // Full cancel + reschedule. Todo counts are small and this only runs when the
  // notification-relevant signature of the slice changes, so the churn is cheap
  // and avoids fragile diffing of expo's trigger objects.
  await cancelOurs();

  for (const todo of todos) {
    const fireDate = fireDateFor(todo);
    if (!fireDate) continue;
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: idFor(todo.id),
        content: {
          title: todo.name,
          body: i18n.t('todos.notifBody'),
          sound: soundEnabled,
          data: { type: TODO_NOTIFICATION_TYPE, todoId: todo.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
        },
      });
    } catch (error) {
      console.error('Failed to schedule todo notification:', error);
    }
  }
};

/** Reconcile scheduled todo-start notifications to match the current todos. */
export const syncTodoNotifications = (
  todos: Todo[],
  soundEnabled: boolean,
): Promise<void> => enqueue(() => reconcileInternal(todos, soundEnabled));

/** Cancel every scheduled todo-start notification (master toggle off / wipe). */
export const cancelAllTodoNotifications = (): Promise<void> => enqueue(cancelOurs);

export type TodoNotificationPermission = 'granted' | 'denied' | 'undetermined';

/**
 * Ensure iOS notification permission for todo reminders. Requests the system
 * prompt when it can still be shown. Returns 'denied' only when the user has
 * permanently declined (the caller should then point them at Settings).
 */
export const ensureTodoNotificationPermission =
  async (): Promise<TodoNotificationPermission> => {
    try {
      const current = await Notifications.getPermissionsAsync();
      if (current.granted) return 'granted';
      if (current.canAskAgain) {
        const requested = await Notifications.requestPermissionsAsync();
        if (requested.granted) return 'granted';
        return requested.canAskAgain ? 'undetermined' : 'denied';
      }
      return 'denied';
    } catch (error) {
      console.error('Failed to ensure todo notification permission:', error);
      return 'undetermined';
    }
  };
