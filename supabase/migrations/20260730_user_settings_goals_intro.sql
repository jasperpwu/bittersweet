-- One-time Goals & Badges intro overlay: track "already shown" in the cloud so a
-- reinstall — which wipes AsyncStorage but keeps the Keychain session — doesn't replay
-- the walkthrough for an existing user. Mirrors has_seen_journal_intro.
--
-- IMPORTANT: apply this BEFORE shipping the client change — settingsToRow() writes this
-- column on every settings sync, so it must exist or all settings upserts will fail.
alter table public.user_settings
  add column if not exists has_seen_goals_intro boolean not null default false;
