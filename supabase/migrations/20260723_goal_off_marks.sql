-- ============================================================
-- Off-Marker: paid streak-skip slots, stored ON the goal.
--
-- A jsonb map bucketed by period type so a goal can flip its
-- activePeriod back and forth and keep each type's marks
-- independently. Keys are the slot START in local calendar terms
-- ("YYYY-MM-DD" — the day / the week's start day / the month's 1st):
--
--   { "daily": ["2026-07-14"], "weekly": ["2026-07-13"], "monthly": ["2026-07-01"] }
--
-- The streak calc and consistency calendar skip any slot whose key
-- is in the matching bucket (neither a hit nor a miss — as if the
-- period never existed). Economy is handled client-side (fruits are
-- debited on Confirm); no separate audit row — the marked cells are
-- the record.
--
-- Lives on focus_goals, so it inherits that table's RLS and syncs
-- through the existing goal list-diff. Mapper: goalToRow.off_marks /
-- rowToGoal.offMarks (SyncMapper.ts) — only emitted when non-empty,
-- so goal sync keeps working until this migration is deployed.
-- ============================================================

alter table public.focus_goals
  add column if not exists off_marks jsonb not null default '{}'::jsonb;
