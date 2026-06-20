-- ============================================================
-- One-time setup tasks on the rewards row
-- Adds a `tasks` jsonb blob to public.rewards holding the per-task state for the
-- in-app setup quests (set up a home-screen widget, set a focus goal), each worth a
-- fixed fruit reward on claim. Shape:
--   { "widget": { "everSetup": bool, "claimed": bool },
--     "goal":   { "everSetup": bool, "claimed": bool } }
--
-- `everSetup` is sticky-true once the prerequisite is detected (so the claim survives
-- removing the widget/goal); `claimed` is true once the fruits are awarded. Both flags
-- are monotonic (only false→true), so the client OR-merges them across reinstalls
-- instead of last-write-wins — the column never needs its own updated_at.
--
-- Additive and idempotent: safe to run regardless of current live schema drift.
-- The client (rewardsToRow / rowToRewards) normalizes any missing keys to false, so
-- the empty-object default backfills cleanly for existing rows.
-- ============================================================

ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS tasks jsonb NOT NULL DEFAULT '{}'::jsonb;
