-- Migration: tear down the shared-tag feature — reverses 20260605_shared_tags.sql.
--
-- The share/join tag flow (tag-picker Share + Join buttons, the Goals "Shared
-- Tag Members" stats card, SharedTagService, and all store actions) was removed
-- from the client. Nothing reads or writes these objects anymore:
--   * session_tags.is_sharing / shared_from_tag_id / shared_from_user_id /
--     shared_owner_name  (SyncMapper no longer maps them, both directions)
--   * shared_tag_links / shared_tag_memberships tables (+ their RLS policies)
--   * resolve_shared_tag_code() / get_shared_tag_joiner_stats() RPCs
--
-- Apply ONLY together with (or after) the client build that removed the feature —
-- an older client still calls the RPCs and upserts the session_tags columns and
-- would error once these are gone.
--
-- No policy/view/function outside this feature depends on the dropped columns
-- (the grove leaderboard was moved off shared_tag_ids back in 20260602, an
-- unrelated grove column). Run manually against the live DB; verify no
-- unexpected dependency error (do NOT `db push`).

BEGIN;

-- RPCs first (they reference the tables/columns below)
DROP FUNCTION IF EXISTS public.get_shared_tag_joiner_stats(TEXT, DATE, DATE, TEXT);
DROP FUNCTION IF EXISTS public.resolve_shared_tag_code(TEXT);

-- Tables (RLS policies drop automatically with the table)
DROP TABLE IF EXISTS public.shared_tag_memberships;
DROP TABLE IF EXISTS public.shared_tag_links;

-- Vestigial columns on session_tags
ALTER TABLE public.session_tags
  DROP COLUMN IF EXISTS is_sharing,
  DROP COLUMN IF EXISTS shared_from_tag_id,
  DROP COLUMN IF EXISTS shared_from_user_id,
  DROP COLUMN IF EXISTS shared_owner_name;

COMMIT;
