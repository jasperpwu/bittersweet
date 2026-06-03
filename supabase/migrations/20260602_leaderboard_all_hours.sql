-- Migration: Leaderboard counts ALL friend focus hours regardless of shared_tag_ids.
-- shared_tag_ids now only controls which sessions appear in the recent activity feed (app-layer filter).
--
-- Changes:
-- 1. Replace focus_sessions RLS: friends can read ALL sessions (no shared_tag_ids check)
-- 2. Replace session_tags RLS: friends can read ALL tags (no shared_tag_ids check)
-- 3. Rewrite get_grove_rankings RPC: sum ALL friend hours (no shared_tag_ids check)

BEGIN;

-- ============================================================
-- 1. Replace focus_sessions SELECT policy
--    Friends can read all sessions (shared_tag_ids filtering
--    moves to the app layer for the feed only)
-- ============================================================

DROP POLICY IF EXISTS "Users and friends can read sessions" ON public.focus_sessions;

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
    )
  );

-- ============================================================
-- 2. Replace session_tags SELECT policy
--    Friends can read all tags
-- ============================================================

DROP POLICY IF EXISTS "Friends can read shared tags" ON public.session_tags;

CREATE POLICY "Friends can read tags"
  ON public.session_tags FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM grove_friendships
      WHERE status = 'accepted'
      AND (
        (requester_id = auth.uid() AND addressee_id = session_tags.user_id)
        OR (addressee_id = auth.uid() AND requester_id = session_tags.user_id)
      )
    )
  );

-- ============================================================
-- 3. Rewrite get_grove_rankings: no shared_tag_ids filter
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
        OR EXISTS (
          SELECT 1 FROM grove_friendships
          WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND addressee_id = fs.user_id)
            OR (addressee_id = auth.uid() AND requester_id = fs.user_id)
          )
        )
      )
    GROUP BY fs.user_id, gp.user_id, gp.display_name, gp.handle, gp.avatar_url, gp.avatar_color, gp.is_focusing
  ) AS row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

COMMIT;
