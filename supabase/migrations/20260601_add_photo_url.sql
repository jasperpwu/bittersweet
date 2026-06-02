-- Add photo_url column to focus_sessions for sharing session photos via feed
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Add foreign key from focus_sessions.tag_id → session_tags.id.
-- This enables PostgREST embedded resource joins (e.g. session_tags(name, icon))
-- and enforces referential integrity.
-- ON DELETE RESTRICT (default) is intentional: tags use soft-delete (deleted_at),
-- so hard-deleting a tag that still has sessions should be blocked.
--
-- Before running: verify no orphan tag_ids exist:
--   SELECT DISTINCT fs.tag_id FROM focus_sessions fs
--   LEFT JOIN session_tags st ON st.id = fs.tag_id
--   WHERE st.id IS NULL;
-- If orphans exist, either create the missing tags or update the sessions first.
ALTER TABLE public.focus_sessions
  ADD CONSTRAINT fk_focus_sessions_tag
  FOREIGN KEY (tag_id) REFERENCES public.session_tags(id);
