-- Add optional secondary_tag_id to focus_sessions.
-- Supports sessions spent on two activities at once (e.g. workout + audiobook):
-- the secondary tag counts toward that tag's analytics, goals, badges, and Grove
-- challenges, while the session's total focus time is still counted once.
--
-- Nullable; no foreign key (unlike the required tag_id) because the secondary tag
-- is resolved client-side and PostgREST embedded joins are not needed for it.
-- An FK to session_tags(id) can be added later if embedded joins become useful.
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS secondary_tag_id TEXT;
