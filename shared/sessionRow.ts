import { clampSessionNotes } from './sessionNotes';
import type { FocusSessionCore, FocusSessionRow, MotionSnapshot, RatingSource } from './types';

/**
 * `focus_sessions` ⇄ Zustand state.
 *
 * `rowToSession` must restore every field `sessionToRow` writes (CLAUDE.md).
 * Both name `FocusSessionRow`, so adding a column to one without the other
 * fails the typecheck in the Expo app *and* the desktop client.
 */

/**
 * Timestamps arrive as `Date` from the store but as ISO strings from anything
 * that has already been serialised (the sync queue, a held session restored
 * from AsyncStorage), so both are accepted and normalised on the way out.
 */
type DateLike = Date | string;

/**
 * What `sessionToRow` accepts. Looser than `FocusSessionCore` because callers
 * pass partially-built sessions (`{ ...session, tagId, photoUrl }`) and
 * queue-restored objects whose Dates are strings.
 */
export interface SessionToRowInput {
  id: string;
  startTime: DateLike;
  endTime: DateLike;
  duration: number;
  initialSetDuration?: number | null;
  actualDuration?: number | null;
  adjustedDuration?: number | null;
  tagId: string;
  secondaryTagId?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  isManualEntry?: boolean;
  accelerateMultiplier?: number;
  focusRating?: number | null;
  ratingSource?: RatingSource | null;
  motionSummary?: MotionSnapshot | null;
  createdAt?: DateLike;
  updatedAt?: DateLike;
  deletedAt?: DateLike | null;
}

export function sessionToRow(session: SessionToRowInput, userId: string): FocusSessionRow {
  const row: FocusSessionRow = {
    id: session.id,
    user_id: userId,
    start_time:
      session.startTime instanceof Date ? session.startTime.toISOString() : session.startTime,
    end_time: session.endTime instanceof Date ? session.endTime.toISOString() : session.endTime,
    duration: session.duration,
    initial_set_duration: session.initialSetDuration ?? null,
    actual_duration: session.actualDuration ?? null,
    adjusted_duration: session.adjustedDuration ?? null,
    tag_id: session.tagId,
    secondary_tag_id: session.secondaryTagId ?? null,
    notes: clampSessionNotes(session.notes) ?? null,
    photo_url: session.photoUrl ?? null,
    is_manual_entry: session.isManualEntry ?? false,
    accelerate_multiplier: session.accelerateMultiplier ?? 1,
    focus_rating: session.focusRating ?? null,
    rating_source: session.ratingSource ?? null,
    motion_summary: session.motionSummary ?? null,
    // Always emit deleted_at (null when active) so an undo/restore explicitly
    // un-tombstones the cloud row. Sessions are hard-deleted locally, so a live
    // session never carries deletedAt → this resolves to null, and re-upserting a
    // restored session clears the deleted_at set by an earlier soft_delete. Without
    // this the row stays tombstoned in the cloud and the next pull drops it.
    deleted_at:
      session.deletedAt instanceof Date
        ? session.deletedAt.toISOString()
        : (session.deletedAt ?? null),
  };
  if (session.createdAt instanceof Date) row.created_at = session.createdAt.toISOString();
  if (session.updatedAt instanceof Date) row.updated_at = session.updatedAt.toISOString();
  return row;
}

export function rowToSession(row: FocusSessionRow): FocusSessionCore {
  return {
    id: row.id,
    startTime: new Date(row.start_time),
    endTime: new Date(row.end_time),
    duration: row.duration,
    initialSetDuration: row.initial_set_duration ?? undefined,
    actualDuration: row.actual_duration ?? undefined,
    adjustedDuration: row.adjusted_duration ?? undefined,
    tagId: row.tag_id,
    secondaryTagId: row.secondary_tag_id ?? undefined,
    notes: row.notes ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    isManualEntry: row.is_manual_entry ?? false,
    accelerateMultiplier: row.accelerate_multiplier ?? 1,
    focusRating: row.focus_rating ?? undefined,
    ratingSource: row.rating_source ?? undefined,
    motionSummary: row.motion_summary ?? undefined,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    ...(row.deleted_at ? { deletedAt: new Date(row.deleted_at) } : {}),
  };
}
