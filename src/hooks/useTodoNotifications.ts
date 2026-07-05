import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppStore } from '../store';
import { useUnifiedStore } from '../store/unified-store';
import {
  syncTodoNotifications,
  cancelAllTodoNotifications,
} from '../services/notifications/todos';
import type { Todo } from '../store/types';

type TodosSlice = ReturnType<typeof useAppStore.getState>['focus']['todos'];

/** Read todos imperatively (not as a subscription) to avoid extra re-renders. */
const getTodos = (): Todo[] => {
  const todos = useAppStore.getState().focus.todos;
  return (todos?.allIds ?? [])
    .map((id) => todos.byId[id])
    .filter(Boolean) as Todo[];
};

/**
 * Compact primitive signature of just the fields that affect a todo's reminder
 * (start, time flag, recurrence, name, completed, deleted). Returning a string
 * keeps this a value-compared selector — the host only re-runs scheduling when
 * a reminder-relevant field actually changes, not on every focus-store write
 * (timer ticks).
 */
const computeSignature = (todos: TodosSlice): string => {
  const ids = todos?.allIds ?? [];
  return ids
    .map((id) => {
      const t = todos.byId[id];
      if (!t) return '';
      const start = t.startAt ? new Date(t.startAt).getTime() : 0;
      const rec = t.recurrence ? JSON.stringify(t.recurrence) : '';
      return `${t.id}:${start}:${t.startHasTime ? 1 : 0}:${t.completed ? 1 : 0}:${t.deletedAt ? 1 : 0}:${rec}:${t.name}`;
    })
    .join('|');
};

/**
 * Lifecycle hook that keeps scheduled todo-start notifications in sync with the
 * todos slice. Call once at the root layout. Because every mutation path
 * (create/edit/drag-schedule/complete/delete/restore/cloud-pull/auth-wipe) lands
 * in `focus.todos`, reconciling on its signature covers them all.
 */
export const useTodoNotifications = () => {
  const isHydrated = useUnifiedStore((s) => s.app.isHydrated);
  const enabled = useUnifiedStore((s) => s.preferences.notifications?.enabled ?? true);
  const soundEnabled = useUnifiedStore((s) => s.preferences.notifications?.sound ?? true);
  const todoSignature = useAppStore((s) => computeSignature(s.focus.todos));

  const reschedule = () => {
    if (!enabled) {
      cancelAllTodoNotifications();
      return;
    }
    syncTodoNotifications(getTodos(), soundEnabled);
  };

  // Reschedule whenever the master toggle, sound, or a reminder-relevant todo
  // field changes. Roll recurring todos forward first (Google Tasks-style):
  // it's idempotent, and when it does advance a todo the signature changes and
  // this effect re-runs against the rolled state.
  useEffect(() => {
    if (!isHydrated) return;
    useAppStore.getState().focus.rollRecurringTodos();
    reschedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, enabled, soundEnabled, todoSignature]);

  // On foreground: roll recurring todos into the new period, then reschedule so
  // date-only reminders whose default hour has passed drop off and any missed
  // scheduling while backgrounded is recovered.
  useEffect(() => {
    if (!isHydrated) return;
    const handleChange = (next: AppStateStatus) => {
      if (next !== 'active') return;
      useAppStore.getState().focus.rollRecurringTodos();
      reschedule();
    };
    const subscription = AppState.addEventListener('change', handleChange);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, enabled, soundEnabled]);
};
