-- Add Apple Health integration settings to user_settings so they sync across
-- reinstalls / restore like every other user preference.
--
-- Synced: whether Health import is enabled, the linked tag, and whether to skip
-- hand-logged workouts. NOT synced: the HealthKit query anchor — that is a
-- device-local read cursor into this device's Health store and must never leave
-- the device (syncing it would cause incremental fetches to skip/duplicate).
--
-- IMPORTANT: apply this BEFORE shipping the client change — settingsToRow()
-- writes these columns on every settings sync, so they must exist or all
-- settings upserts will fail.
alter table public.user_settings
  add column if not exists healthkit_enabled boolean not null default false,
  add column if not exists healthkit_linked_tag_id text,
  add column if not exists healthkit_skip_user_entered boolean not null default false;
