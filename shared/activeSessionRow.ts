import type { ActiveSessionCore, ActiveSessionRow, SessionDeviceKind } from './types';

/**
 * `active_sessions` ⇄ client state.
 *
 * `rowToActiveSession` must restore every field the table carries (CLAUDE.md).
 * There is no `activeSessionToRow` counterpart on purpose: writes go through the
 * `start_active_session` / `stop_active_session` RPCs, which build the row
 * server-side from `auth.uid()` and the arguments below. A client never
 * assembles a full row, so there is nothing to keep symmetric in that direction.
 */

/** Arguments for the `start_active_session` RPC, named exactly as the function's parameters. */
export interface StartActiveSessionArgs {
  p_session_id: string;
  p_tag_id: string;
  p_started_at: string;
  /** Null = infinite / count-up session. */
  p_target_minutes: number | null;
  p_origin: SessionDeviceKind;
}

export function startActiveSessionArgs(params: {
  sessionId: string;
  tagId: string;
  startedAt: Date;
  targetMinutes?: number;
  origin: SessionDeviceKind;
}): StartActiveSessionArgs {
  return {
    p_session_id: params.sessionId,
    p_tag_id: params.tagId,
    p_started_at: params.startedAt.toISOString(),
    p_target_minutes: params.targetMinutes ?? null,
    p_origin: params.origin,
  };
}

export function rowToActiveSession(row: ActiveSessionRow): ActiveSessionCore {
  return {
    userId: row.user_id,
    sessionId: row.session_id,
    tagId: row.tag_id,
    startedAt: new Date(row.started_at),
    ...(row.ended_at ? { endedAt: new Date(row.ended_at) } : {}),
    targetMinutes: row.target_minutes ?? undefined,
    origin: row.origin,
    ...(row.stopped_by ? { stoppedBy: row.stopped_by } : {}),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

/** A live session is one that has started and not yet been stopped. */
export function isRunning(active: ActiveSessionCore | null): active is ActiveSessionCore {
  return active != null && active.endedAt == null;
}

/**
 * Elapsed whole minutes, the unit `focus_sessions.duration` is stored in.
 * Shared so desktop and iOS cannot disagree about how long a session ran.
 */
export function elapsedMinutes(active: ActiveSessionCore, endedAtMs: number): number {
  return Math.floor((endedAtMs - active.startedAt.getTime()) / 60000);
}
