import * as Notifications from 'expo-notifications';
import i18n from '../../i18n';
import { nextOccurrence, startOfDay } from '../../utils/todoRecurrence';
import type { Todo } from '../../store/types';

// One local notification per open todo with a future start (or a set of
// repeating triggers for a recurring todo), keyed deterministically off the
// todo id so reconciliation is idempotent.
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

interface TriggerSpec {
  identifier: string;
  trigger: Notifications.NotificationTriggerInput;
}

// Earliest occurrence of `rec` strictly in the future, scanning from `from`'s
// day and carrying `anchor`'s reminder time. Null when none lands in the
// future (can't really happen for a valid recurrence — pure safety).
const nextFutureOccurrence = (
  rec: NonNullable<Todo['recurrence']>,
  anchor: Date,
  from: Date,
): Date | null => {
  let fire = nextOccurrence(rec, anchor, from);
  for (let guard = 0; guard < 3 && fire.getTime() <= Date.now(); guard++) {
    const nextFrom = startOfDay(fire);
    nextFrom.setDate(nextFrom.getDate() + 1);
    fire = nextOccurrence(rec, anchor, nextFrom);
  }
  return fire.getTime() > Date.now() ? fire : null;
};

// The notification trigger(s) a todo should have right now, or [] for none:
// deleted, no start, one-off already passed/completed.
const triggersFor = (todo: Todo): TriggerSpec[] => {
  if (!todo.startAt || todo.deletedAt) return [];
  const start = new Date(todo.startAt);
  const hasTime = !!todo.startHasTime;
  const hour = hasTime ? start.getHours() : DEFAULT_DATE_ONLY_HOUR;
  const minute = hasTime ? start.getMinutes() : 0;
  // The current occurrence with its reminder time-of-day applied.
  const anchor = new Date(start);
  anchor.setHours(hour, minute, 0, 0);
  const rec = todo.recurrence;

  if (!rec) {
    if (todo.completed || anchor.getTime() <= Date.now()) return [];
    return [
      {
        identifier: idFor(todo.id),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: anchor },
      },
    ];
  }

  if (todo.completed) {
    // Current occurrence already done — a repeating trigger would still fire
    // for it, so remind at the NEXT occurrence via a one-shot instead. The
    // rollover resets `completed`, and the following reconcile reinstates the
    // repeating triggers.
    const dayAfter = startOfDay(start);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const fire = nextFutureOccurrence(rec, anchor, dayAfter);
    if (!fire) return [];
    return [
      {
        identifier: idFor(todo.id),
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
      },
    ];
  }

  switch (rec.freq) {
    case 'daily':
      return [
        {
          identifier: idFor(todo.id),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
        },
      ];
    case 'weekly':
      // One trigger per selected weekday. expo/iOS weekdays are 1=Sun..7.
      return (rec.weekdays ?? [start.getDay()]).map((weekday) => ({
        identifier: `${idFor(todo.id)}-w${weekday}`,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: weekday + 1,
          hour,
          minute,
        },
      }));
    case 'monthly': {
      const day = rec.monthDay ?? start.getDate();
      if (day <= 28) {
        return [
          {
            identifier: idFor(todo.id),
            trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day, hour, minute },
          },
        ];
      }
      // Days 29–31: an iOS repeating trigger silently skips months without
      // that day, while we clamp to the month's last day. Schedule the next
      // clamped occurrence as a one-shot; every foreground reconcile (and each
      // rollover, which changes startAt) refreshes it.
      const fire = nextFutureOccurrence(rec, anchor, startOfDay(new Date()));
      if (!fire) return [];
      return [
        {
          identifier: idFor(todo.id),
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
        },
      ];
    }
  }
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
    for (const { identifier, trigger } of triggersFor(todo)) {
      try {
        await Notifications.scheduleNotificationAsync({
          identifier,
          content: {
            title: todo.name,
            body: i18n.t('todos.notifBody'),
            sound: soundEnabled,
            data: { type: TODO_NOTIFICATION_TYPE, todoId: todo.id },
          },
          trigger,
        });
      } catch (error) {
        console.error('Failed to schedule todo notification:', error);
      }
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
