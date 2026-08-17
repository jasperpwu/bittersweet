/**
 * Wire types shared by the Expo app and the desktop client.
 *
 * Two layers, deliberately separate:
 *  - `*Row`  — the Supabase row (snake_case, ISO strings, nulls). This is the
 *    contract between the clients; both mappers name it, so a field written by
 *    `xToRow` with no inverse in `rowToX` is a compile error in both projects.
 *  - `*Core` — what a row round-trips into (camelCase, Date objects). The iOS
 *    model in `src/types/models.ts` extends these with its local-only fields,
 *    so the local shape is provably a superset rather than a second copy.
 *
 * See ./README.md — this folder has no dependencies and must never gain any.
 */

// --- Enums ---

/** How a tag's work is expected to look to Core Motion. */
export type ActivityType = 'stationary' | 'self_rated' | 'active';

/** Who set a session's star rating. */
export type RatingSource = 'suggested' | 'user';

/** How a session's physical motion is characterised. */
export type MotionProfile = 'still' | 'occasional' | 'constant' | 'unknown';

/** Which signal produced the classification (surfaced in the "why" sheet). */
export type MotionSignal = 'activity' | 'none';

/** CMMotionActivity time breakdown (motion-insights native module). */
export interface MotionActivitySummary {
  stationarySec: number;
  walkingSec: number;
  runningSec: number;
  cyclingSec: number;
  automotiveSec: number;
  unknownSec: number;
  totalSec: number;
}

/**
 * Snapshot persisted on the session so the insights sheet still works after the
 * ~7-day Core Motion history window has expired. Stored as a JSONB blob, so it
 * crosses the wire unchanged (inner camelCase keys preserved).
 */
export interface MotionSnapshot {
  signal: MotionSignal;
  profile: MotionProfile;
  activity?: MotionActivitySummary | null;
  steps?: number | null;
}

// --- focus_sessions ---

/**
 * A `focus_sessions` row, exactly as it goes over the wire.
 *
 * A `type` alias rather than an `interface` on purpose: only aliases get an
 * implicit index signature, and these rows are passed to helpers typed
 * `Record<string, any>` (`normalizedToRows`, `SyncService.enqueue`).
 */
export type FocusSessionRow = {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  initial_set_duration: number | null;
  actual_duration: number | null;
  adjusted_duration: number | null;
  tag_id: string;
  secondary_tag_id: string | null;
  notes: string | null;
  photo_url: string | null;
  is_manual_entry: boolean;
  accelerate_multiplier: number;
  focus_rating: number | null;
  rating_source: RatingSource | null;
  motion_summary: MotionSnapshot | null;
  deleted_at: string | null;
  // Omitted when the local object has no timestamp yet, so the DB defaults apply.
  created_at?: string;
  updated_at?: string;
};

/** The syncable core of a focus session — every field a row round-trips. */
export interface FocusSessionCore {
  id: string;
  startTime: Date;
  endTime: Date;
  /** Adjusted duration in minutes; the value analytics and the UI read. */
  duration: number;
  initialSetDuration?: number;
  actualDuration?: number;
  adjustedDuration?: number;
  tagId: string;
  secondaryTagId?: string;
  notes?: string;
  photoUrl?: string;
  isManualEntry?: boolean;
  accelerateMultiplier?: number;
  focusRating?: number;
  ratingSource?: RatingSource;
  motionSummary?: MotionSnapshot;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// --- session_tags ---

/** A `session_tags` row, exactly as it goes over the wire. (A `type`, for the
 * same implicit-index-signature reason as `FocusSessionRow`.) */
export type SessionTagRow = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  activity_type: string | null;
  // Omitted when the local object has no timestamp yet, so the DB defaults apply.
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
};

/** The syncable core of a session tag — every field a row round-trips. */
export interface SessionTagCore {
  id: string;
  name: string;
  icon: string;
  /** Hex string like '#6592E9'. Tag colors are data, not UI chrome. */
  color: string;
  sortOrder: number;
  activityType?: ActivityType;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}
