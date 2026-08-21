import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { rowToActiveSession, startActiveSessionArgs } from '../../shared/activeSessionRow';
import type { ActiveSessionCore, ActiveSessionRow } from '../../shared/types';
import { supabase } from '../config/supabase';

/**
 * The `active_sessions` record — a focus session that is currently running,
 * shared with the desktop client so either device can follow the other.
 *
 * This is deliberately NOT part of the sync pipeline (`syncMiddleware` /
 * `SyncQueue`). That pipeline is a debounced, offline-tolerant, last-write-wins
 * differ, and every property it has is wrong here: a live session is a single
 * mutable row whose whole value is being current, it must never be replayed from
 * an offline queue minutes later, and a stale write would resurrect a finished
 * session. Writes go straight out and are allowed to fail — the local timer is
 * the source of truth for the phone, this record only mirrors it.
 *
 * Requires `supabase/migrations/20260816_active_sessions.sql`.
 */

/** Reported to the other device so it can tell its own events from ours. */
const ORIGIN = 'ios' as const;

export const ActiveSessionService = {
  /**
   * Publish a session the phone just started.
   *
   * Returns the live record, or null when the RPC refused because a session is
   * already running elsewhere. The phone does NOT roll its local timer back on
   * a refusal: the user physically pressed start here, and losing their session
   * to a stale desktop row would be worse than the two briefly disagreeing.
   * The next stop clears the row either way.
   */
  async publishStart(params: {
    sessionId: string;
    tagId: string;
    startedAt: Date;
    /** Undefined for an infinite / count-up session. */
    targetMinutes?: number;
  }): Promise<ActiveSessionCore | null> {
    try {
      const { data, error } = await supabase.rpc(
        'start_active_session',
        startActiveSessionArgs({ ...params, origin: ORIGIN })
      );
      if (error) {
        console.warn('[ActiveSession] publishStart failed:', error.message);
        return null;
      }
      return data ? rowToActiveSession(data as ActiveSessionRow) : null;
    } catch (e) {
      console.warn('[ActiveSession] publishStart threw:', e);
      return null;
    }
  },

  /** Mark the live session finished. No-ops when nothing is running. */
  async publishStop(): Promise<ActiveSessionCore | null> {
    try {
      const { data, error } = await supabase.rpc('stop_active_session', {
        p_stopped_by: ORIGIN,
      });
      if (error) {
        console.warn('[ActiveSession] publishStop failed:', error.message);
        return null;
      }
      return data ? rowToActiveSession(data as ActiveSessionRow) : null;
    } catch (e) {
      console.warn('[ActiveSession] publishStop threw:', e);
      return null;
    }
  },

  /** The current live record, if any. Used on foreground to catch up. */
  async fetch(userId: string): Promise<ActiveSessionCore | null> {
    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.warn('[ActiveSession] fetch failed:', error.message);
        return null;
      }
      return data ? rowToActiveSession(data as ActiveSessionRow) : null;
    } catch (e) {
      console.warn('[ActiveSession] fetch threw:', e);
      return null;
    }
  },

  /**
   * Watch the live record. Caller owns the returned channel and must remove it.
   *
   * Only worth running while the app is foregrounded — a websocket does not
   * survive the app being backgrounded or swiped away, which is exactly the gap
   * Phases 3 and 4 exist to close.
   */
  subscribe(userId: string, onChange: (active: ActiveSessionCore | null) => void): RealtimeChannel {
    return supabase
      .channel(`active_sessions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<ActiveSessionRow>) => {
          if (payload.eventType === 'DELETE') {
            onChange(null);
            return;
          }
          onChange(rowToActiveSession(payload.new as ActiveSessionRow));
        }
      )
      .subscribe();
  },
};
