import {
  isHealthDataAvailable,
  requestAuthorization,
  getRequestStatusForAuthorization,
  queryWorkoutSamplesWithAnchor,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';

/**
 * HealthKitService — thin, read-only wrapper around Apple HealthKit workouts.
 *
 * Scope (intentionally narrow):
 *  - Read access to Workouts only. No write, no other data types, no background delivery.
 *  - Pulls are on-demand (foreground sync), driven by the focus store.
 *
 * See `importHealthKitWorkouts` in focusSlice for how these map to sessions.
 */

const WORKOUT_TYPE = 'HKWorkoutTypeIdentifier' as const;

/** A HealthKit workout flattened to the fields we actually use. */
export interface ImportableWorkout {
  /** Stable HealthKit sample UUID — used to build a deterministic session id. */
  uuid: string;
  startDate: Date;
  endDate: Date;
  /** Duration in minutes (rounded). */
  durationMinutes: number;
  /** HKWorkoutActivityType enum value (e.g. running = 37). */
  activityType: WorkoutActivityType;
  /** True when the user hand-logged this in the Health/Fitness app (vs recorded by a device/app). */
  wasUserEntered: boolean;
  /** Originating app/device name, e.g. "Apple Watch", "Strava", "Health". */
  sourceName: string;
}

/** Whether HealthKit exists on this device (false on iPad/simulator without Health). */
export function isHealthKitAvailable(): boolean {
  try {
    return isHealthDataAvailable();
  } catch {
    return false;
  }
}

/**
 * Prompt the user for read access to Workouts.
 * Returns true if the request flow completed (NOTE: iOS never reveals whether the
 * user granted *read* access, so a `true` here only means "the prompt was shown").
 */
export async function requestWorkoutAuthorization(): Promise<boolean> {
  if (!isHealthKitAvailable()) return false;
  return requestAuthorization({ toRead: [WORKOUT_TYPE] });
}

/**
 * Best-effort check of whether we've already asked for workout authorization.
 * Returns 'unnecessary' once the prompt has been shown (granted or denied — iOS
 * does not distinguish for read types), 'shouldRequest' before we've asked.
 */
export async function getWorkoutAuthorizationStatus(): Promise<
  'shouldRequest' | 'unknown' | 'unnecessary'
> {
  if (!isHealthKitAvailable()) return 'unknown';
  const status = await getRequestStatusForAuthorization({ toRead: [WORKOUT_TYPE] });
  // AuthorizationRequestStatus: 0 unknown, 1 shouldRequest, 2 unnecessary
  if (status === 1) return 'shouldRequest';
  if (status === 2) return 'unnecessary';
  return 'unknown';
}

export interface WorkoutQueryResult {
  workouts: ImportableWorkout[];
  /** Opaque anchor to persist and pass back next sync to only fetch new workouts. */
  newAnchor: string;
}

/**
 * Fetch workouts since the last sync.
 *
 * Pass the previously-returned `anchor` to fetch only workouts added since then.
 * On the first call pass `undefined` together with `sinceDate` to bound the very
 * first import to a sane window (we don't want to import years of history).
 */
export async function fetchWorkouts(options: {
  anchor?: string;
  sinceDate?: Date;
}): Promise<WorkoutQueryResult> {
  const { anchor, sinceDate } = options;

  const res = await queryWorkoutSamplesWithAnchor({
    limit: 0, // 0 / negative = all matching
    anchor,
    // Only apply a date floor on the first (anchorless) pull; afterwards the anchor handles it.
    filter: !anchor && sinceDate ? { date: { startDate: sinceDate } } : undefined,
  });

  const workouts: ImportableWorkout[] = res.workouts.map((w) => {
    // A workout has both an interval (startDate→endDate) and an `active` duration
    // (excludes pauses). We anchor sessions to start/end, so prefer wall-clock to
    // stay consistent with the stored times; fall back to the duration field if the
    // interval is degenerate (e.g. hasUndeterminedDuration / zero-length sources).
    const wallClockSeconds = Math.max(0, (w.endDate.getTime() - w.startDate.getTime()) / 1000);
    const activeSeconds = w.duration?.quantity ?? 0;
    const durationSeconds = wallClockSeconds > 0 ? wallClockSeconds : activeSeconds;
    return {
      uuid: w.uuid,
      startDate: w.startDate,
      endDate: w.endDate,
      durationMinutes: Math.round(durationSeconds / 60),
      activityType: w.workoutActivityType,
      wasUserEntered: w.metadata?.HKWasUserEntered === true,
      sourceName: w.sourceRevision?.source?.name ?? 'Unknown',
    };
  });

  return { workouts, newAnchor: res.newAnchor };
}
