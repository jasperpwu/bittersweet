import { useCallback, useEffect, useRef, useState } from 'react';
import { rowToSession } from 'shared/sessionRow';
import type { FocusSessionCore, FocusSessionRow } from 'shared/types';
import { supabase } from '../supabase';

/** How much history the desktop client keeps in memory. */
const HISTORY_LIMIT = 200;

/**
 * Session history, kept live with a Realtime `postgres_changes` subscription.
 *
 * The subscription is what makes "start on the phone, see it on the laptop"
 * work without polling. It requires `focus_sessions` to be in the
 * `supabase_realtime` publication — see
 * `supabase/migrations/20260816_realtime_focus_sessions.sql`. Without that
 * migration the channel still subscribes successfully and simply never fires,
 * which is why `realtime` is surfaced below rather than left silent.
 */
export function useSessions(userId: string | undefined) {
  const [sessions, setSessions] = useState<FocusSessionCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<'connecting' | 'live' | 'error'>('connecting');

  // Realtime events can land before the initial select resolves; merging into a
  // ref-free setState closure is enough because every update is functional.
  const mountedRef = useRef(true);

  const upsert = useCallback((row: FocusSessionRow) => {
    setSessions((prev) => {
      // A soft delete arrives as an UPDATE with deleted_at set, not a DELETE.
      if (row.deleted_at) return prev.filter((s) => s.id !== row.id);

      const next = rowToSession(row);
      const at = prev.findIndex((s) => s.id === next.id);
      const merged = at >= 0 ? prev.map((s) => (s.id === next.id ? next : s)) : [next, ...prev];
      merged.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      return merged.slice(0, HISTORY_LIMIT);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    mountedRef.current = true;

    (async () => {
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('start_time', { ascending: false })
        .limit(HISTORY_LIMIT);

      if (!mountedRef.current) return;
      if (error) setError(error.message);
      else setSessions((data as FocusSessionRow[]).map(rowToSession));
      setLoading(false);
    })();

    const channel = supabase
      .channel(`focus_sessions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'focus_sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id;
            // Only present when the table is REPLICA IDENTITY FULL; otherwise
            // the hard delete shows up on the next reload instead.
            if (id) setSessions((prev) => prev.filter((s) => s.id !== id));
            return;
          }
          upsert(payload.new as FocusSessionRow);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtime('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtime('error');
      });

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [userId, upsert]);

  return { sessions, loading, error, realtime };
}
