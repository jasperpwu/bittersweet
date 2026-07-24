import { Alert } from 'react-native';
import i18n from '../../i18n';
import { useAppStore } from '../../store';
import { useUnifiedStore } from '../../store/unified-store';
import {
  fetchWorkouts,
  getWorkoutAuthorizationStatus,
  isHealthKitAvailable,
  requestWorkoutAuthorization,
} from './HealthKitService';

// Guards against overlapping reconnect prompts — sync can fire from cold-start
// and foreground near-simultaneously, and we never want two stacked dialogs.
let reconnectPromptInFlight = false;

/**
 * Ask the user (via our own dialog) before re-showing the native HealthKit
 * prompt, and report their choice. We gate on OUR dialog because iOS never
 * reveals whether a *read* prompt was granted or denied — but it does tell us
 * whether the user accepted this one, which is what lets us honor a decline.
 */
function confirmReconnect(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      i18n.t('health.reconnectTitle'),
      i18n.t('health.reconnectBody'),
      [
        { text: i18n.t('health.reconnectCancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: i18n.t('health.reconnectConfirm'), onPress: () => resolve(true) },
      ],
      { onDismiss: () => resolve(false) }
    );
  });
}

// On a reinstall / new device the `enabled` flag syncs down from the cloud but
// the device-local `anchor` and `enabledAt` are gone, so we can't know exactly
// how far we'd synced. Re-scan this bounded recent window to recover workouts
// recorded while the app was gone, without ever dumping long-lived history.
// Over-scanning is free: imports are idempotent (deterministic `hk-<uuid>` ids
// skip anything already synced), so already-imported workouts are dropped.
const RECONNECT_BACKFILL_DAYS = 30;

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
    // Reconcile per-device authorization. The `enabled` preference syncs down
    // from the cloud, but HealthKit authorization is local to iOS and never
    // syncs — so after a reinstall/new device the flag is on while iOS status is
    // `notDetermined`, and a workout query throws HKError Code=5 ("Authorization
    // not determined"). Rather than silently re-popping the native sheet, prime
    // the user with our own dialog explaining the mismatch: accept → show the
    // native prompt; decline → turn the app setting off (the one signal iOS
    // *does* give us, since it hides read grant/deny). Guarded so overlapping
    // syncs (cold-start + foreground) can't stack two dialogs; a declined or
    // disabled state then no-ops future syncs, so this can't nag.
    if ((await getWorkoutAuthorizationStatus()) === 'shouldRequest') {
      if (reconnectPromptInFlight) return null;
      reconnectPromptInFlight = true;
      try {
        const accepted = await confirmReconnect();
        if (accepted) {
          await requestWorkoutAuthorization();
        } else {
          // User declined our dialog → disable the app setting so we stop asking
          // and stop attempting reads. `enabled` is synced, so this propagates.
          const latest = useUnifiedStore.getState().preferences.healthKit;
          await useUnifiedStore.getState().updatePreferences({
            healthKit: { ...latest, enabled: false },
          });
          return null;
        }
      } finally {
        reconnectPromptInFlight = false;
      }
    }

    // Pick the first-fetch floor from how this device came to be enabled:
    //  - `anchor` present → incremental sync; the anchor is the floor, ignore dates.
    //  - `enabledAt` present → the user connected on THIS device; floor at that
    //    moment so we only pull workouts recorded since connect (no history backfill).
    //  - neither, but `enabled` is true → the flag synced down from the cloud onto a
    //    device that never locally toggled it (reinstall / new device). Re-scan a
    //    bounded recent window so a reinstall doesn't silently drop the workouts
    //    recorded while the app was gone; id dedup makes the over-scan safe.
    let sinceDate: Date | undefined;
    if (hk.anchor) {
      sinceDate = undefined;
    } else if (hk.enabledAt) {
      sinceDate = new Date(hk.enabledAt);
    } else {
      sinceDate = new Date(Date.now() - RECONNECT_BACKFILL_DAYS * 24 * 60 * 60 * 1000);
    }

    const { workouts, newAnchor } = await fetchWorkouts({
      anchor: hk.anchor ?? undefined,
      sinceDate,
    });

    const result = useAppStore.getState().focus.importHealthKitWorkouts(workouts, hk.linkedTagId);

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
