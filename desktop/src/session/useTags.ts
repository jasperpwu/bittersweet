import { useEffect, useState } from 'react';
import { rowToTag } from 'shared/tagRow';
import type { SessionTagCore, SessionTagRow } from 'shared/types';
import { supabase } from '../supabase';

/**
 * The user's tags, newest state from the cloud.
 *
 * Read-only in Phase 1 — tags are created and edited on iOS. No realtime
 * subscription either: tags change rarely, and a desktop session that opens
 * mid-edit picks the change up on next load.
 */
export function useTags(userId: string | undefined) {
  const [tags, setTags] = useState<SessionTagCore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from('session_tags')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (!active) return;
      if (error) {
        setError(error.message);
      } else {
        const mapped = (data as SessionTagRow[]).map(rowToTag);
        mapped.sort((a, b) => a.sortOrder - b.sortOrder);
        setTags(mapped);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  return { tags, loading, error };
}
