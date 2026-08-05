-- Migration: Grove moderation — user blocking + content reporting.
--
-- Required by App Store Review Guideline 1.2 (user-generated content): the app
-- must let users report objectionable content and block abusive users.
--
-- Adds:
-- 1. grove_blocks      — one row per (blocker, blocked) pair.
-- 2. grove_reports     — one row per report; optional session_id for post-level
--                        reports, reason + free-text details.
-- 3. grove_is_blocked() — helper used by RLS; true when EITHER user has blocked
--                        the other, so a block hides content in both directions.
-- 4. RESTRICTIVE policies that subtract blocked pairs from whatever the
--    existing permissive policies allow.
--
-- Why RESTRICTIVE and not a rewrite of the 20260719 policies: permissive
-- policies OR together, so adding a block guard to one of several SELECT
-- policies on a table would be bypassed by the others (e.g. a separate
-- "friends can read profiles" policy). RESTRICTIVE policies AND with the
-- whole permissive set, so this holds no matter which policies exist or how
-- the live schema has drifted — and nothing already granted is rewritten.
--
-- NOTE: apply manually against the live DB (schema has drifted from tracked
-- migrations; do NOT `db push`).

BEGIN;

-- ============================================================
-- 1. grove_blocks
-- ============================================================

CREATE TABLE IF NOT EXISTS public.grove_blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT grove_blocks_unique_pair UNIQUE (blocker_id, blocked_id),
  CONSTRAINT grove_blocks_no_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX IF NOT EXISTS grove_blocks_blocker_idx ON public.grove_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS grove_blocks_blocked_idx ON public.grove_blocks (blocked_id);

ALTER TABLE public.grove_blocks ENABLE ROW LEVEL SECURITY;

-- A user sees and manages only the blocks they created. Deliberately NOT
-- readable by the blocked user — blocking is silent.
DROP POLICY IF EXISTS "Users can read own blocks" ON public.grove_blocks;
CREATE POLICY "Users can read own blocks" ON public.grove_blocks FOR SELECT
  USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can create own blocks" ON public.grove_blocks;
CREATE POLICY "Users can create own blocks" ON public.grove_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "Users can delete own blocks" ON public.grove_blocks;
CREATE POLICY "Users can delete own blocks" ON public.grove_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- ============================================================
-- 2. grove_reports
-- ============================================================

CREATE TABLE IF NOT EXISTS public.grove_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Set when reporting a specific session; NULL for a profile-level report.
  -- TEXT, not UUID: focus_sessions.id is a client-generated TEXT id (same as
  -- grove_reactions.session_id). SET NULL rather than CASCADE so a report
  -- survives the reported session being deleted.
  session_id        TEXT REFERENCES public.focus_sessions(id) ON DELETE SET NULL,
  reason            TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'impersonation', 'other')),
  details           TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at       TIMESTAMPTZ,
  CONSTRAINT grove_reports_no_self CHECK (reporter_id <> reported_user_id)
);

CREATE INDEX IF NOT EXISTS grove_reports_pending_idx
  ON public.grove_reports (created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS grove_reports_reported_user_idx
  ON public.grove_reports (reported_user_id);

ALTER TABLE public.grove_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can file and re-read their own reports. Nobody reads anyone else's
-- through the client — triage happens in the Supabase dashboard / service role.
DROP POLICY IF EXISTS "Users can read own reports" ON public.grove_reports;
CREATE POLICY "Users can read own reports" ON public.grove_reports FOR SELECT
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can create own reports" ON public.grove_reports;
CREATE POLICY "Users can create own reports" ON public.grove_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ============================================================
-- 3. Blocked-pair helper
-- ============================================================

-- SECURITY DEFINER so RLS policies can consult grove_blocks rows owned by the
-- *other* party (the "Users can read own blocks" policy would otherwise hide
-- the row where the other user blocked me).
CREATE OR REPLACE FUNCTION public.grove_is_blocked(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.grove_blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$;

GRANT EXECUTE ON FUNCTION public.grove_is_blocked(UUID, UUID) TO authenticated;
-- ============================================================
-- 4. Subtract blocked pairs from every visibility path (RESTRICTIVE)
-- ============================================================
--
-- Each policy keeps the owner's own access intact (auth.uid() = user_id) and
-- otherwise requires that neither side has blocked the other. Because these are
-- RESTRICTIVE they AND with the existing permissive policies rather than
-- replacing them, so no currently-granted access is rewritten here.

-- grove_profiles: a blocked pair can no longer see each other's profile,
-- whether it is surfaced by search, discovery, or a friend-list read.
DROP POLICY IF EXISTS "Hide blocked profiles" ON public.grove_profiles;
CREATE POLICY "Hide blocked profiles" ON public.grove_profiles
  AS RESTRICTIVE FOR SELECT
  USING (
    auth.uid() = user_id
    OR NOT public.grove_is_blocked(auth.uid(), grove_profiles.user_id)
  );

-- focus_sessions: blocked authors drop out of the feed and friend feed.
DROP POLICY IF EXISTS "Hide blocked sessions" ON public.focus_sessions;
CREATE POLICY "Hide blocked sessions" ON public.focus_sessions
  AS RESTRICTIVE FOR SELECT
  USING (
    auth.uid() = user_id
    OR NOT public.grove_is_blocked(auth.uid(), focus_sessions.user_id)
  );

-- session_tags: tag names stop resolving for blocked authors.
DROP POLICY IF EXISTS "Hide blocked tags" ON public.session_tags;
CREATE POLICY "Hide blocked tags" ON public.session_tags
  AS RESTRICTIVE FOR SELECT
  USING (
    auth.uid() = user_id
    OR NOT public.grove_is_blocked(auth.uid(), session_tags.user_id)
  );

-- grove_reactions: a blocked user's claps disappear from sessions that are
-- still visible (their own sessions are already hidden by the policy above).
DROP POLICY IF EXISTS "Hide blocked reactions" ON public.grove_reactions;
CREATE POLICY "Hide blocked reactions" ON public.grove_reactions
  AS RESTRICTIVE FOR SELECT
  USING (
    auth.uid() = user_id
    OR NOT public.grove_is_blocked(auth.uid(), grove_reactions.user_id)
  );

-- grove_friendships: blocking must also stop the connection re-forming. The
-- client deletes the existing friendship when blocking; this stops either side
-- sending a fresh request afterwards.
DROP POLICY IF EXISTS "No friendships between blocked users" ON public.grove_friendships;
CREATE POLICY "No friendships between blocked users" ON public.grove_friendships
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (NOT public.grove_is_blocked(requester_id, addressee_id));

-- ============================================================
-- 5. Blocked-profile lookup for the unblock screen
-- ============================================================

-- "Hide blocked profiles" above makes blocked profiles unreadable through a
-- normal select — including on the screen where you go to unblock them. This
-- SECURITY DEFINER function is the deliberate exception: it returns profiles
-- ONLY for users the caller has personally blocked.
CREATE OR REPLACE FUNCTION public.get_blocked_profiles()
RETURNS SETOF public.grove_profiles
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gp.*
  FROM public.grove_profiles gp
  JOIN public.grove_blocks b ON b.blocked_id = gp.user_id
  WHERE b.blocker_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_blocked_profiles() TO authenticated;

COMMIT;
