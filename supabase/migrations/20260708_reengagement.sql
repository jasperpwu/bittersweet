-- ============================================================
-- Re-engagement notifications
-- Server-side nudges for users who have stopped opening the app.
--
-- Tiers by inactivity: 2 days, 5 days, 14 days — then the 14-day nudge repeats
-- every 14 days until the user returns. Any real activity (a foreground ping)
-- resets the streak.
--
-- The `reengagement-cron` Edge Function runs hourly, finds users whose local
-- time is ~10am and who have crossed a tier, picks a feature they haven't used
-- yet (goals, todos, grove, store, blocklist, Apple Health), and pushes a
-- localized nudge that deep-links straight there. If every feature is used it
-- falls back to a welcome-back ("come focus") or a "share a suggestion" nudge.
-- ============================================================

-- last_active_at is pinged by the client on every app foreground (see
-- ActivityPingService). Deliberately kept OUT of user_settings: it changes on
-- every open, and folding it into the synced settings blob would churn the
-- sync layer's last-write-wins baseline. timezone (IANA, e.g. 'America/New_York')
-- lets the cron deliver around the user's local morning.
CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  timezone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The cron scans by last_active_at (find the quiet users).
CREATE INDEX IF NOT EXISTS idx_user_activity_last_active
  ON public.user_activity (last_active_at);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own activity" ON public.user_activity FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_user_activity_updated_at
  BEFORE UPDATE ON public.user_activity
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- One row per user tracking the last nudge, so the hourly cron never resends the
-- same tier within an inactivity streak. `last_nudge_at > user_activity.last_active_at`
-- means the nudge belongs to the CURRENT streak (the user hasn't returned since).
-- Written only by the cron (service role bypasses RLS); users get read-only for
-- debugging.
CREATE TABLE IF NOT EXISTS public.reengagement_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_nudge_at TIMESTAMPTZ,
  last_tier TEXT,               -- '2d' | '5d' | '14d'
  last_feature TEXT,            -- feature/fallback promoted in the last nudge
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reengagement_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own reengagement state" ON public.reengagement_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER set_reengagement_state_updated_at
  BEFORE UPDATE ON public.reengagement_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---- Cron: hourly, so every timezone's ~10am window is caught. Same vault +
-- net.http_post pattern as the challenge/heartbeat crons (see grove-schema.sql).
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent re-run: drop any prior schedule before (re)creating it.
SELECT cron.unschedule('reengagement-cron')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reengagement-cron');

SELECT cron.schedule(
  'reengagement-cron',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/reengagement-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
