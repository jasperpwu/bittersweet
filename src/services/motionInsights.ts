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
  type RecordedAccelSummary,
  type MotionActivitySummary,
} from '../utils/focusRating';

async function safe<T>(fn: () => Promise<T | null> | undefined): Promise<T | null> {
  try {
    return (await fn()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Ensure the Motion & Fitness permission is requested (shows the system prompt
 * on first call). CMMotionActivity / CMPedometer / CMSensorRecorder all share
 * this authorization. Safe to call repeatedly. Returns true if granted.
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

/**
 * Start recording raw accelerometer for the session's duration. Call at session
 * start. No-op (and never throws) when the native module/CMSensorRecorder is
 * unavailable.
 */
export async function startSessionMotionRecording(durationSec: number): Promise<void> {
  if (!MotionInsights || durationSec <= 0) return;
  try {
    // Request up front so the prompt appears at session start and the recorder
    // has authorization for the whole session window.
    await ensureMotionPermission();
    await MotionInsights.startAccelerometerRecording(Math.round(durationSec));
  } catch {
    // Recording is best-effort; the CMMotionActivity fallback covers failures.
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
 * Read all available motion signals for a finished session window and classify
 * them into a MotionSnapshot (recorder preferred, CMMotionActivity fallback).
 */
export async function getSessionMotionSnapshot(
  startMs: number,
  endMs: number
): Promise<MotionSnapshot> {
  await ensureMotionPermission();
  const [recorder, activity, steps] = await Promise.all([
    safe<RecordedAccelSummary>(() =>
      MotionInsights?.getRecordedAccelerometerSummary(startMs, endMs)
    ),
    safe<MotionActivitySummary>(() => MotionInsights?.getMotionActivitySummary(startMs, endMs)),
    getStepCount(startMs, endMs),
  ]);
  // Diagnostic: shows in Metro which signal won. recorder=null means the
  // CMSensorRecorder buffer was empty (the known iPhone failure mode) and we
  // fell back to CMMotionActivity.
  console.log('[motionInsights] nativeModule=', !!MotionInsights, 'recorder=', recorder, 'activity=', activity, 'steps=', steps);
  return classifyMotion({ recorder, activity, steps });
}
