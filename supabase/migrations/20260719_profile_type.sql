-- Migration: Grove "Profile Type" (public / private) visibility.
--
-- Adds grove_profiles.profile_type ('public' | 'private', default 'public').
--   • public  → anyone signed in can read the profile + its sessions/tags
--               (powers search→view-feed and the <5-friends discovery feed).
--   • private → only accepted friends can read (previous behaviour).
--
-- Changes:
-- 1. Add profile_type column (default 'public').
-- 2. grove_profiles: anyone can read PUBLIC + active profiles.
-- 3. focus_sessions RLS: readable by owner, accepted friends, OR anyone if the
--    author is public + active.
-- 4. session_tags RLS: same (so tag names resolve for public sessions).
-- 5. grove_reactions RLS: reaction counts visible on any visible session
--    (friend OR public). Insert already allows anyone (auth.uid() = user_id).
--
-- NOTE: apply manually against the live DB (schema has drifted from tracked
-- migrations; do NOT `db push`). Verify policy names against the live catalog
-- before running — the names below match migration 20260602_leaderboard_all_hours.

BEGIN;

-- ============================================================
-- 1. Add profile_type column
-- ============================================================

ALTER TABLE public.grove_profiles
  ADD COLUMN IF NOT EXISTS profile_type TEXT NOT NULL DEFAULT 'public'
  CHECK (profile_type IN ('public', 'private'));

-- ============================================================
-- 2. grove_profiles: anyone can read public + active profiles
-- ============================================================

DROP POLICY IF EXISTS "Anyone can read public profiles" ON public.grove_profiles;
CREATE POLICY "Anyone can read public profiles" ON public.grove_profiles FOR SELECT
  USING (profile_type = 'public' AND is_active = true);

-- ============================================================
-- 3. focus_sessions: owner OR accepted friend OR public author
-- ============================================================

DROP POLICY IF EXISTS "Users and friends can read sessions" ON public.focus_sessions;
CREATE POLICY "Users and friends can read sessions"
  ON public.focus_sessions FOR SELECT
  USING (
    auth.uid() = user_id
    OR (
      deleted_at IS NULL
      AND (
        EXISTS (
          SELECT 1 FROM grove_friendships
          WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND addressee_id = focus_sessions.user_id)
            OR (addressee_id = auth.uid() AND requester_id = focus_sessions.user_id)
          )
        )
        OR EXISTS (
          SELECT 1 FROM grove_profiles gp
          WHERE gp.user_id = focus_sessions.user_id
          AND gp.profile_type = 'public'
          AND gp.is_active = true
        )
      )
    )
  );

-- ============================================================
-- 4. session_tags: owner OR accepted friend OR public author
-- ============================================================

DROP POLICY IF EXISTS "Friends can read tags" ON public.session_tags;
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
    OR EXISTS (
      SELECT 1 FROM grove_profiles gp
      WHERE gp.user_id = session_tags.user_id
      AND gp.profile_type = 'public'
      AND gp.is_active = true
    )
  );

-- ============================================================
-- 5. grove_reactions: reaction counts visible on any visible session
-- ============================================================

DROP POLICY IF EXISTS "Users can view reactions on visible sessions" ON public.grove_reactions;
CREATE POLICY "Users can view reactions on visible sessions" ON public.grove_reactions FOR SELECT
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
        OR EXISTS (
          SELECT 1 FROM grove_profiles gp
          WHERE gp.user_id = fs.user_id
          AND gp.profile_type = 'public'
          AND gp.is_active = true
        )
      )
    )
  );

COMMIT;
