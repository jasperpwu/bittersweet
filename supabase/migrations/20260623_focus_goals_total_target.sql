-- Add support for "no-period" (cumulative) focus goals.
--
-- A no-period goal counts ALL of a tag's focus time toward a single lifetime
-- target and never resets. Two schema changes are needed:
--   1. total_target_minutes — where the cumulative target is stored.
--   2. active_period must accept the new 'none' value.
--
-- IMPORTANT: apply this BEFORE shipping the client change — goalToRow() writes
-- total_target_minutes and active_period='none' on every goal sync, so the column
-- must exist and the check constraint must allow 'none' or goal upserts will fail.

alter table public.focus_goals
  add column if not exists total_target_minutes integer not null default 0;

-- Relax any CHECK constraint that limits active_period to daily/weekly/monthly so
-- 'none' is accepted. The constraint name has drifted across environments, so find
-- and drop any check on focus_goals that references the period values, then add an
-- inclusive one. Idempotent: safe to re-run.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'focus_goals'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%weekly%'
      and pg_get_constraintdef(con.oid) ilike '%monthly%'
  loop
    execute format('alter table public.focus_goals drop constraint %I', c.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint where conname = 'focus_goals_active_period_check'
  ) then
    alter table public.focus_goals
      add constraint focus_goals_active_period_check
      check (active_period in ('daily', 'weekly', 'monthly', 'none'));
  end if;
end $$;
