import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppStore } from '../store';
import { useUnifiedStore } from '../store/unified-store';
import { scheduleGoalNudges, cancelAllGoalNudges } from '../services/notifications/local';
import { getGoalCurrentTarget } from '../utils/goalProgress';
import type { FocusGoal, FocusSession } from '../store/types';

/**
 * Reads focus data from the store imperatively (not as a subscription).
 * This avoids re-rendering the host component on every focus state change.
 */
const getFocusData = () => {
  const focus = useAppStore.getState().focus;

  const goals = (focus.goals?.allIds ?? [])
    .map(id => focus.goals.byId[id])
    .filter(Boolean) as FocusGoal[];

  const sessions = (focus.sessions?.allIds ?? [])
    .map(id => focus.sessions.byId[id])
    .filter(Boolean) as FocusSession[];

  const tagMap = (focus.tags?.allIds ?? []).reduce((map, id) => {
    const tag = focus.tags.byId[id];
    if (tag) {
      map[id] = { id: tag.id, name: tag.name };
    }
    return map;
  }, {} as Record<string, { id: string; name: string }>);

  return { goals, sessions, tagMap };
};

/**
 * Lifecycle hook that schedules/cancels daily goal nudge notifications.
 * Call once at the root layout level.
 *
 * Uses granular selectors (primitives only) so it doesn't cause the host
 * component to re-render on every focus store update.
 */
export const useGoalNudgeNotifications = () => {
  // Subscribe only to primitive values to avoid unnecessary re-renders
  const isHydrated = useUnifiedStore(state => state.app.isHydrated);
  const goalReminderEnabled = useUnifiedStore(
    state => state.preferences.notifications?.goalReminderEnabled ?? true,
  );
  const goalReminderTime = useUnifiedStore(
    state => state.preferences.notifications?.goalReminderTime ?? '20:00',
  );
  const soundEnabled = useUnifiedStore(
    state => state.preferences.notifications?.sound ?? true,
  );
  // Lightweight counters to detect data changes without subscribing to the whole slice
  const goalCount = useAppStore(state => state.focus.goals?.allIds?.length ?? 0);
  const sessionCount = useAppStore(state => state.focus.sessions?.allIds?.length ?? 0);

  const cacheKeyRef = useRef<string>('');

  const reschedule = () => {
    if (!goalReminderEnabled) {
      cancelAllGoalNudges();
      cacheKeyRef.current = '';
      return;
    }

    // Read focus data imperatively (not via subscription)
    const { goals, sessions, tagMap } = getFocusData();

    const goalsKey = goals.map(g => `${g.id}:${getGoalCurrentTarget(g)}`).join(',');
    const newKey = `${goalsKey}|${sessions.length}|${goalReminderTime}`;

    if (newKey === cacheKeyRef.current) return;
    cacheKeyRef.current = newKey;

    scheduleGoalNudges(goals, sessions, tagMap, goalReminderTime, soundEnabled);
  };

  // Reschedule when dependencies change
  useEffect(() => {
    if (!isHydrated) return;
    reschedule();
  }, [isHydrated, goalReminderEnabled, goalReminderTime, goalCount, sessionCount]);

  // Reschedule on app foreground
  useEffect(() => {
    if (!isHydrated) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        cacheKeyRef.current = '';
        reschedule();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isHydrated, goalReminderEnabled, goalReminderTime]);
};
