import type { ActiveSessionCore } from 'shared/types';

/**
 * How a running session reads right now.
 *
 * The window and the menu bar item both draw the same session, so they read it
 * through this one function and cannot drift apart. They still choose their own
 * wording: the window has room for "· over time", the menu bar has room for a
 * plus sign.
 */
export interface ClockReading {
  /** Whole seconds since the session started. */
  elapsed: number;
  /**
   * Whole seconds left against the target, negative once the session runs past
   * it. Undefined when the session counts up with no target.
   */
  remaining: number | undefined;
}

export function readClock(active: ActiveSessionCore, nowMs: number): ClockReading {
  const elapsed = Math.floor((nowMs - active.startedAt.getTime()) / 1000);
  return {
    elapsed,
    remaining: active.targetMinutes != null ? active.targetMinutes * 60 - elapsed : undefined,
  };
}

/** `mm:ss`, or `h:mm:ss` past an hour. Negative input reads as zero. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
