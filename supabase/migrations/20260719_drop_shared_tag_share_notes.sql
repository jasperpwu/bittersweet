-- Migration: drop the now-unused grove_privacy_settings.shared_tag_ids and
-- share_notes columns.
--
-- Both are vestigial: the feed always shows all tags and always includes
-- notes/photos (see 20260602 which already moved RLS off shared_tag_ids, and the
-- app-layer change that stopped stripping notes). The only remaining consumers
-- were JS write-paths, removed in the same client build as this migration.
--
-- Apply ONLY together with (or after) that client build — an older client still
-- inserts these columns via createPrivacySettings and would error once dropped.
--
-- Safe to drop: live SELECT policies were rewritten off shared_tag_ids in
-- 20260602 (get_grove_rankings + focus_sessions/session_tags policies), so no
-- policy/view/function depends on either column. Run manually against the live
-- DB; verify no unexpected dependency error (do NOT `db push`).

BEGIN;

ALTER TABLE public.grove_privacy_settings DROP COLUMN IF EXISTS shared_tag_ids;
ALTER TABLE public.grove_privacy_settings DROP COLUMN IF EXISTS share_notes;

COMMIT;
