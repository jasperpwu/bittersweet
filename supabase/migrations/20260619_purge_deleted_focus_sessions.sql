-- ============================================================
-- Purge soft-deleted focus_sessions (pg_cron)
-- Sessions are soft-deleted (deleted_at set) rather than removed, so the client's
-- sync layer never resurrects them: pullAll() filters `deleted_at IS NULL`, and an
-- upsert of a deleted id leaves deleted_at untouched (sessionToRow omits it), so the
-- tombstone keeps the row filtered out regardless of op ordering.
--
-- The tombstone only needs to outlive in-flight client sync (offline queues, a device
-- that hasn't reopened yet). After a retention window it's safe to hard-delete and
-- reclaim storage. 30 days is the conservative default — change the interval below to
-- adjust. Pure SQL DELETE; no Edge Function required.
--
-- Runs as the cron/superuser role, so RLS does not restrict it — it purges across all
-- users. Requires the pg_cron extension (already enabled for the challenge/heartbeat
-- crons; the CREATE EXTENSION below is a no-op if so).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent re-run: drop any prior schedule before (re)creating it.
SELECT cron.unschedule('purge-deleted-focus-sessions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-focus-sessions');

-- Weekly on Sunday at 05:00 UTC (off-peak; distinct from the 03:00/04:00 function crons).
SELECT cron.schedule(
  'purge-deleted-focus-sessions',
  '0 5 * * 0',
  $$
  DELETE FROM public.focus_sessions
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';
  $$
);
