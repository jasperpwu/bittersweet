-- Sync the last-used tag across devices / reinstalls, like the per-tag durations
-- (`last_duration_by_tag`) already do. Without it a reinstalled user lands on
-- "Select a tag" even though their tags were pulled from the cloud.
--
-- Deliberately NOT a foreign key to session_tags: the client soft-deletes tags
-- and already guards a dangling/deleted id by falling back to the first tag, and
-- an FK would make settings upserts order-dependent on the tag upserts.
--
-- IMPORTANT: apply this BEFORE shipping the client change — settingsToRow()
-- writes this column on every settings sync, so it must exist or all settings
-- upserts will fail.
alter table public.user_settings
  add column if not exists last_selected_tag_id text;
