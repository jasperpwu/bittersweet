import { useAppStore } from '../../store';
import { useUnifiedStore } from '../../store/unified-store';
import { fetchWorkouts, isHealthKitAvailable } from './HealthKitService';

// First-ever import is bounded so we don't pull years of workout history.
const FIRST_IMPORT_WINDOW_DAYS = 30;

/**
 * Foreground sync entry point for Apple Health → focus sessions.
 *
 * Reads the user's HealthKit preferences, fetches workouts added since the last
 * sync (via the persisted anchor), files them under the linked tag, and persists
 * the new anchor. No-ops cleanly when HealthKit is unavailable, disabled, or no
 * tag is linked. Safe to call on every app foreground.
 *
 * Returns the import counts, or null if nothing was attempted.
 */
export async function syncHealthKitWorkouts(): Promise<{
  imported: number;
  skipped: number;
} | null> {
  if (!isHealthKitAvailable()) return null;

  // Premium gate: Apple Health import is a paid feature, so a lapsed
  // subscription disables the sync even if the stored flag is still on.
  if (useAppStore.getState().subscription.tier !== 'premium') return null;

  const hk = useUnifiedStore.getState().preferences.healthKit;
  if (!hk?.enabled || !hk.linkedTagId) return null;

  try {
    const sinceDate = hk.anchor
      ? undefined
      : new Date(Date.now() - FIRST_IMPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const { workouts, newAnchor } = await fetchWorkouts({
      anchor: hk.anchor ?? undefined,
      sinceDate,
    });

    const result = useAppStore.getState().focus.importHealthKitWorkouts(workouts, hk.linkedTagId, {
      skipUserEntered: hk.skipUserEntered,
    });

    // Persist the new anchor so the next sync only fetches newer workouts.
    // (Re-read prefs in case the user toggled something during the await.)
    const latest = useUnifiedStore.getState().preferences.healthKit;
    await useUnifiedStore.getState().updatePreferences({
      healthKit: { ...latest, anchor: newAnchor },
    });

    return result;
  } catch (e) {
    console.error('[HealthKit] sync failed', e);
    return null;
  }
}
