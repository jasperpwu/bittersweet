/**
 * JS wrapper around the native `motion-insights` module + expo-sensors pedometer.
 *
 * Everything here degrades gracefully: if the native module isn't built, a
 * permission is denied, or a Core Motion query throws, we return null/empty so
 * the rating engine falls back to 5★ (no penalty) rather than crashing.
 */
import { Pedometer } from 'expo-sensors';
import MotionInsights from '../../modules/motion-insights';
import {
  classifyMotion,
  type MotionSnapshot,
  type MotionActivitySummary,
} from '../utils/focusRating';

async function safe<T>(fn: () => Promise<T | null> | undefined): Promise<T | null> {
  try {
    return (await fn()) ?? null;
  } catch {
    return null;
  }
}

export type MotionPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Read the current Motion & Fitness authorization WITHOUT prompting. Lets the UI
 * decide whether to show the priming pop-up (undetermined) before triggering the
 * one-shot system prompt.
 */
export async function getMotionPermissionStatus(): Promise<MotionPermissionStatus> {
  try {
    const current = await Pedometer.getPermissionsAsync();
    if (current.granted) return 'granted';
    if (current.canAskAgain) return 'undetermined';
    return 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Ensure the Motion & Fitness permission is requested (shows the system prompt
 * on first call). CMMotionActivity and CMPedometer share this authorization.
 * Safe to call repeatedly. Returns true if granted.
 *
 * NOTE: this triggers the one-shot iOS prompt. Always show the in-app priming
 * pop-up first (or have the user explicitly enable a setting) so the OS prompt is
 * never the user's first, context-free encounter with the request.
 */
export async function ensureMotionPermission(): Promise<boolean> {
  try {
    const current = await Pedometer.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Pedometer.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

async function getStepCount(startMs: number, endMs: number): Promise<number | null> {
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) return null;
    const result = await Pedometer.getStepCountAsync(new Date(startMs), new Date(endMs));
    return result?.steps ?? null;
  } catch {
    return null;
  }
}

/**
 * Read the CMMotionActivity signal for a finished session window and classify
 * it into a MotionSnapshot.
 */
export async function getSessionMotionSnapshot(
  startMs: number,
  endMs: number
): Promise<MotionSnapshot> {
  // Permission is the caller's responsibility (priming pop-up / settings toggle).
  // If it isn't granted the reads below return null and we report signal 'none'.
  // Rating is driven entirely by the retroactive CMMotionActivity query; the old
  // CMSensorRecorder forward-recording path was removed (its mere allocation
  // popped the Motion & Fitness prompt at launch — see MotionInsightsModule).
  const [activity, steps] = await Promise.all([
    safe<MotionActivitySummary>(() => MotionInsights?.getMotionActivitySummary(startMs, endMs)),
    getStepCount(startMs, endMs),
  ]);
  return classifyMotion({ activity, steps });
}
