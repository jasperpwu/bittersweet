-- ============================================================
-- Daily unlock-minutes history on the rewards row
-- Adds an `unlock_history` jsonb map to public.rewards holding, per local calendar
-- day, the total minutes the user actually spent unlocking blocked apps. Shape:
--   { "2026-06-30": 12, "2026-07-01": 5 }  -- YYYY-MM-DD (device-local) -> minutes
--
-- Feeds the unlock time trend chart shown in the unlock modal. Stored on the rewards
-- row (not blocklist) because every history change coincides with a fruit spend
-- (unlock) or refund (early end), so it rides the rewards row's existing
-- last-write-wins sync via rewards.updated_at — no separate column timestamp needed.
-- The client prunes to the most recent ~30 days, so the map stays small.
--
-- Additive and idempotent: safe to run regardless of current live schema drift.
-- The client (rewardsToRow / rowToRewards) defaults a missing/invalid value to {},
-- so the empty-object default backfills cleanly for existing rows.
-- ============================================================

ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS unlock_history jsonb NOT NULL DEFAULT '{}'::jsonb;
