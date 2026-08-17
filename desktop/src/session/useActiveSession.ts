import { useCallback, useEffect, useState } from 'react';
import {
  elapsedMinutes,
  isRunning,
  rowToActiveSession,
  startActiveSessionArgs,
} from 'shared/activeSessionRow';
import { generateId } from 'shared/id';
import { sessionToRow } from 'shared/sessionRow';
import type { ActiveSessionCore, ActiveSessionRow } from 'shared/types';
import { supabase } from '../supabase';

/** Sessions shorter than this are cancelled, not recorded — matches iOS. */
const MIN_RECORDED_MINUTES = 1;

/**
 * The user's live session, if any — the record iOS follows.
 *
 * Start and stop go through the `start_active_session` / `stop_active_session`
 * RPCs rather than a direct upsert. PostgREST cannot express a conditional
 * upsert, so a plain write here would silently clobber a session already running
 * on the phone; the RPC returns null instead and we surface that.
 *
 * Requires `supabase/migrations/20260816_active_sessions.sql`.
 */
export function useActiveSession(userId: string | undefined) {
  const [active, setActive] = useState<ActiveSessionCore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!alive) return;
      if (error) setError(error.message);
      else setActive(data ? rowToActiveSession(data as ActiveSessionRow) : null);
    })();

    // The row is updated in place rather than deleted on stop, so every
    // transition arrives as INSERT or UPDATE carrying the full new record. A
    // DELETE would only carry the primary key — see the migration's note.
    const channel = supabase
      .channel(`active_sessions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setActive(null);
            return;
          }
          setActive(rowToActiveSession(payload.new as ActiveSessionRow));
        }
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const start = useCallback(
    async (tagId: string, targetMinutes: number | undefined) => {
      setError(null);
      setBusy(true);
      try {
        const { data, error } = await supabase.rpc(
          'start_active_session',
          startActiveSessionArgs({
            sessionId: generateId(),
            tagId,
            startedAt: new Date(),
            targetMinutes,
            origin: 'desktop',
          })
        );

        if (error) {
          setError(error.message);
          return;
        }
        if (!data) {
          // The RPC's DO UPDATE ... WHERE ended_at is not null matched nothing.
          setError('A session is already running on your phone.');
          return;
        }
        setActive(rowToActiveSession(data as ActiveSessionRow));
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const stop = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('stop_active_session', {
        p_stopped_by: 'desktop',
      });

      if (error) {
        setError(error.message);
        return;
      }
      // Null means nothing was running — already stopped on the phone. Not an error.
      if (!data) {
        setActive(null);
        return;
      }

      const stopped = rowToActiveSession(data as ActiveSessionRow);
      setActive(stopped);

      const endedAt = stopped.endedAt ?? new Date();
      const minutes = elapsedMinutes(stopped, endedAt.getTime());

      // Under a minute is a cancelled session on iOS; don't record one here either.
      if (minutes < MIN_RECORDED_MINUTES) return;

      // Write the finished row deliberately minimally: tag, times, duration. Fruits,
      // badges, streaks and ratings are iOS's to compute — a desktop-created row is
      // an input to that logic, not a result of it. The id comes from the live
      // record, so if the phone is open and finishing the same session, both writes
      // converge on one row instead of creating a duplicate.
      const { error: writeError } = await supabase.from('focus_sessions').upsert(
        sessionToRow(
          {
            id: stopped.sessionId,
            startTime: stopped.startedAt,
            endTime: endedAt,
            duration: minutes,
            initialSetDuration: stopped.targetMinutes ?? minutes,
            tagId: stopped.tagId,
            isManualEntry: false,
          },
          stopped.userId
        )
      );
      if (writeError) setError(writeError.message);
    } finally {
      setBusy(false);
    }
  }, []);

  return { active, running: isRunning(active), busy, error, start, stop };
}
