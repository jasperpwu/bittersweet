-- ============================================================
-- TODOs: separable start date/time + optional deadline.
-- - start_has_time / deadline_has_time distinguish a "date only" todo
--   (no meaningful time-of-day, hidden from the calendar) from a fully
--   timed one. NULL is treated as "has time" for start (legacy rows
--   predate this column and always carried a real time).
-- ============================================================

alter table public.todos
  add column if not exists start_has_time boolean,
  add column if not exists deadline_at timestamptz,
  add column if not exists deadline_has_time boolean;
