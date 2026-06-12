-- ============================================================
-- Fix focus_goals -> auth.users cascade (account deletion blocker)
-- The remote DB had `focus_goals_user_id_fkey` as ON DELETE NO ACTION (schema
-- drift from 20260522_initial_schema.sql, which declares ON DELETE CASCADE).
-- Because every user has focus_goals rows, `auth.admin.deleteUser` failed with
-- "Database error deleting user" — the NO ACTION FK blocked the cascade.
-- Realign it to ON DELETE CASCADE so deleting the auth user removes goals too.
-- ============================================================

ALTER TABLE public.focus_goals
  DROP CONSTRAINT IF EXISTS focus_goals_user_id_fkey;

ALTER TABLE public.focus_goals
  ADD CONSTRAINT focus_goals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
