import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

/**
 * The signed-in Supabase session, or null.
 *
 * `restored` distinguishes "definitely signed out" from "haven't checked yet" —
 * without it the sign-in form flashes on every reload while getSession()
 * resolves. Same reason the iOS root layout gates on `sessionRestored`.
 */
export function useSession(): { session: Session | null; restored: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setRestored(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setRestored(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, restored };
}
