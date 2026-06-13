-- Add adhd_mode_enabled to user_settings.
-- Premium-only preference that unlocks an optional secondary tag per focus session.
-- Defaults to false so existing rows and new sign-ups start with the feature off.
--
-- IMPORTANT: apply this BEFORE shipping the client change — settingsToRow() writes
-- adhd_mode_enabled on every settings sync, so the column must exist or all
-- settings upserts will fail.
alter table public.user_settings
  add column if not exists adhd_mode_enabled boolean not null default false;
