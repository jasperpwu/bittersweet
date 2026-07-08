import { supabase } from '../../config/supabase';

// Records "the user opened the app" server-side so the re-engagement cron can
// tell when someone has gone quiet (see supabase/functions/reengagement-cron).
// Deliberately a standalone table (user_activity), NOT part of the synced
// settings blob — these writes happen on every foreground and would otherwise
// churn the sync layer's last-write-wins baseline.
//
// Best-effort and debounced: a failure never blocks the UI, and we skip writes
// that land within PING_INTERVAL_MS of the last successful one.
const PING_INTERVAL_MS = 5 * 60 * 1000;

let lastPingAt = 0;

export const ActivityPingService = {
  /**
   * Upsert last_active_at (+ the device's IANA timezone, so the cron can send
   * around local morning). Call on app foreground and after sign-in.
   * @param force Bypass the debounce (used right after sign-in).
   */
  async ping(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - lastPingAt < PING_INTERVAL_MS) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return; // not signed in — nothing to record

      lastPingAt = now;

      // IANA zone, e.g. "America/New_York". Undefined on exotic runtimes → null.
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('user_activity')
        .upsert(
          { user_id: user.id, last_active_at: nowIso, timezone, updated_at: nowIso },
          { onConflict: 'user_id' }
        );

      if (error) {
        console.warn('Activity ping failed:', error.message);
        lastPingAt = 0; // allow a retry on the next foreground
      }
    } catch (error) {
      console.warn('Activity ping error:', error);
      lastPingAt = 0;
    }
  },
};
