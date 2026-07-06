-- Sync the applied fruit-store slider theme across devices / reinstalls like
-- every other user preference. Theme OWNERSHIP already syncs via the purchases
-- table (product_id `theme_<id>`, see src/config/sliderThemes.ts); this column
-- records which owned theme is currently applied. Null = classic (default) look.
--
-- IMPORTANT: apply this BEFORE shipping the client change — settingsToRow()
-- writes this column on every settings sync, so it must exist or all settings
-- upserts will fail.
alter table public.user_settings
  add column if not exists slider_theme_id text;
