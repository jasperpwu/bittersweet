import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useUnifiedStore } from '../store/unified-store';
import { generateWeeklyReport, hasReportForWeek } from '../services/coach';
import { scheduleWeeklyCoachNudge, cancelWeeklyCoachNudge } from '../services/notifications/coach';
import { useLanguage } from '../i18n/useLanguage';

/** Reference date inside the last completed (Mon–Sun) week. */
const lastCompletedWeekRef = (): Date => {
  const ref = new Date();
  ref.setDate(ref.getDate() - 7);
  return ref;
};

/**
 * Lifecycle hook for the AI Focus Coach. Call once at the root layout.
 *
 * On hydrate and on every app foreground it:
 *  1) generates the last completed week's report if it doesn't exist yet (the engine
 *     enforces the min-data gate and is idempotent by week id), then
 *  2) schedules the weekly "report ready" nudge ONLY when that week actually produced
 *     a report — so we never notify a user who'd just land on an empty state. If not
 *     (sub-threshold week, or notifications off), any pending nudge is cancelled.
 *
 * Subscribes only to primitive preference values so it never re-renders the host on
 * focus-store changes; report generation reads the store imperatively.
 */
export const useWeeklyCoach = () => {
  const isHydrated = useUnifiedStore((state) => state.app.isHydrated);
  const notificationsEnabled = useUnifiedStore(
    (state) => state.preferences.notifications?.enabled ?? true
  );
  const soundEnabled = useUnifiedStore((state) => state.preferences.notifications?.sound ?? true);
  // The nudge text is localized at schedule time, so a language switch must re-schedule it.
  const language = useLanguage();

  const generatingRef = useRef(false);

  const ensureReport = async (): Promise<void> => {
    if (generatingRef.current) return;
    // Skip if the last completed week already has a report — avoids re-running (and
    // re-syncing) the same week on every foreground.
    if (hasReportForWeek(lastCompletedWeekRef())) return;

    generatingRef.current = true;
    try {
      await generateWeeklyReport();
    } catch (error) {
      console.error('[coach] weekly report generation failed:', error);
    } finally {
      generatingRef.current = false;
    }
  };

  const reschedule = () => {
    // Only nudge when notifications are on AND last week produced a report to open.
    if (notificationsEnabled && hasReportForWeek(lastCompletedWeekRef())) {
      scheduleWeeklyCoachNudge(soundEnabled);
    } else {
      cancelWeeklyCoachNudge();
    }
  };

  // Generate first, then schedule against the now-up-to-date report state.
  const tick = async () => {
    await ensureReport();
    reschedule();
  };

  // React to hydrate + preference changes.
  useEffect(() => {
    if (!isHydrated) return;
    void tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, notificationsEnabled, soundEnabled, language]);

  // Re-check on app foreground (a new week may have rolled over while backgrounded).
  useEffect(() => {
    if (!isHydrated) return;
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') void tick();
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, notificationsEnabled, soundEnabled]);
};
