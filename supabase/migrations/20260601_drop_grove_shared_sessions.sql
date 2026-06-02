-- Migration: Drop grove_shared_sessions, use focus_sessions as single source of truth
-- This migration:
-- 1. Adds friend RLS on focus_sessions (replacing the owner-only SELECT policy)
-- 2. Adds friend RLS on session_tags for shared tags
-- 3. Migrates grove_reactions FK from grove_shared_sessions to focus_sessions
-- 4. Drops grove_shared_sessions table
-- 5. Rewrites get_grove_rankings RPC to query focus_sessions

BEGIN;

-- ============================================================
-- 1. Replace owner-only SELECT policy on focus_sessions
--    with one that also lets friends see shared-tag sessions
-- ============================================================

DROP POLICY IF EXISTS "Users can read own sessions" ON public.focus_sessions;

CREATE POLICY "Users and friends can read sessions"
  ON public.focus_sessions FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM grove_friendships
        WHERE status = 'accepted'
        AND (
          (requester_id = auth.uid() AND addressee_id = focus_sessions.user_id)
          OR (addressee_id = auth.uid() AND requester_id = focus_sessions.user_id)
        )
      )
      AND EXISTS (
        SELECT 1 FROM grove_privacy_settings
        WHERE user_id = focus_sessions.user_id
        AND focus_sessions.tag_id = ANY(shared_tag_ids)
      )
    )
  );

-- ============================================================
-- 2. Add friend RLS on session_tags for shared tags
-- ============================================================

CREATE POLICY "Friends can read shared tags"
  ON public.session_tags FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      EXISTS (
        SELECT 1 FROM grove_friendships
        WHERE status = 'accepted'
        AND (
          (requester_id = auth.uid() AND addressee_id = session_tags.user_id)
          OR (addressee_id = auth.uid() AND requester_id = session_tags.user_id)
        )
      )
      AND EXISTS (
        SELECT 1 FROM grove_privacy_settings
        WHERE user_id = session_tags.user_id
        AND session_tags.id = ANY(shared_tag_ids)
      )
    )
  );

-- ============================================================
-- 3. Migrate grove_reactions FK from grove_shared_sessions → focus_sessions
-- ============================================================

-- Drop RLS policy FIRST (it depends on the column we're about to alter)
DROP POLICY IF EXISTS "Users can view reactions on visible sessions" ON grove_reactions;

-- Drop existing FK constraint and unique constraint
ALTER TABLE grove_reactions DROP CONSTRAINT IF EXISTS grove_reactions_shared_session_id_fkey;
ALTER TABLE grove_reactions DROP CONSTRAINT IF EXISTS unique_reaction;

-- Drop index that references the old column
DROP INDEX IF EXISTS idx_reactions_session;

-- Remap: shared_session_id currently holds grove_shared_sessions.id (UUID).
-- We need to replace it with grove_shared_sessions.session_id (which is the focus_sessions.id TEXT).
-- First, add a temporary column to hold the remapped value.
ALTER TABLE grove_reactions ADD COLUMN new_session_id TEXT;

-- Populate from the lookup table
UPDATE grove_reactions r
SET new_session_id = ss.session_id
FROM grove_shared_sessions ss
WHERE ss.id = r.shared_session_id;

-- Delete any reactions that couldn't be mapped (orphaned)
DELETE FROM grove_reactions WHERE new_session_id IS NULL;

-- Delete reactions whose mapped session_id doesn't exist in focus_sessions (stale data)
DELETE FROM grove_reactions
WHERE new_session_id NOT IN (SELECT id FROM focus_sessions);

-- Drop the old UUID column, rename the new one
ALTER TABLE grove_reactions DROP COLUMN shared_session_id;
ALTER TABLE grove_reactions RENAME COLUMN new_session_id TO session_id;

-- Make it NOT NULL
ALTER TABLE grove_reactions ALTER COLUMN session_id SET NOT NULL;

-- Add new FK to focus_sessions
ALTER TABLE grove_reactions
  ADD CONSTRAINT grove_reactions_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id) ON DELETE CASCADE;

-- Re-create unique constraint with new column name
ALTER TABLE grove_reactions
  ADD CONSTRAINT unique_reaction UNIQUE (session_id, user_id);

-- Re-create index
CREATE INDEX idx_reactions_session ON grove_reactions(session_id);

CREATE POLICY "Users can view reactions on visible sessions" ON grove_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM focus_sessions fs
      WHERE fs.id = grove_reactions.session_id
      AND (
        fs.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM grove_friendships
          WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND addressee_id = fs.user_id)
            OR (addressee_id = auth.uid() AND requester_id = fs.user_id)
          )
        )
      )
    )
  );

-- ============================================================
-- 4. Drop grove_shared_sessions table (cascades indexes and policies)
-- ============================================================

DROP TABLE IF EXISTS grove_shared_sessions CASCADE;

-- ============================================================
-- 5. Rewrite get_grove_rankings RPC to query focus_sessions
-- ============================================================

CREATE OR REPLACE FUNCTION get_grove_rankings(
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(row_data ORDER BY total_minutes DESC)
  INTO result
  FROM (
    SELECT
      fs.user_id,
      SUM(fs.duration) AS total_minutes,
      json_build_object(
        'user_id', gp.user_id,
        'display_name', gp.display_name,
        'handle', gp.handle,
        'avatar_url', gp.avatar_url,
        'avatar_color', gp.avatar_color,
        'is_focusing', gp.is_focusing
      ) AS profile
    FROM focus_sessions fs
    JOIN grove_profiles gp ON gp.user_id = fs.user_id
    WHERE fs.start_time >= period_start
      AND fs.start_time < period_end
      AND fs.deleted_at IS NULL
      AND (
        fs.user_id = auth.uid()
        OR (
          EXISTS (
            SELECT 1 FROM grove_friendships
            WHERE status = 'accepted'
            AND (
              (requester_id = auth.uid() AND addressee_id = fs.user_id)
              OR (addressee_id = auth.uid() AND requester_id = fs.user_id)
            )
          )
          AND EXISTS (
            SELECT 1 FROM grove_privacy_settings
            WHERE user_id = fs.user_id
            AND fs.tag_id = ANY(shared_tag_ids)
          )
        )
      )
    GROUP BY fs.user_id, gp.user_id, gp.display_name, gp.handle, gp.avatar_url, gp.avatar_color, gp.is_focusing
  ) AS row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

COMMIT;
