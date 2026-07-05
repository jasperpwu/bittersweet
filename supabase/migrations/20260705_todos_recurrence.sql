-- ============================================================
-- TODOs: recurrence rule for Google Tasks-style repeating todos.
-- JSONB mirror of the app's TodoRecurrence type:
--   { "freq": "daily" | "weekly" | "monthly",
--     "weekdays": int[]  -- weekly only, 0=Sun..6=Sat
--     "monthDay": int }  -- monthly only, 1-31 (29-31 clamp to
--                        -- the last day of shorter months)
-- NULL = one-off todo. start_at always holds the CURRENT occurrence;
-- the app advances it when a new period begins.
-- ============================================================

alter table public.todos
  add column if not exists recurrence jsonb;
