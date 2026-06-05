-- =============================================================
-- Shared Tag Feature: columns, tables, RLS, and RPCs
-- =============================================================

-- 1A. New columns on session_tags
ALTER TABLE public.session_tags
  ADD COLUMN IF NOT EXISTS is_sharing BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shared_from_tag_id TEXT,
  ADD COLUMN IF NOT EXISTS shared_from_user_id UUID,
  ADD COLUMN IF NOT EXISTS shared_owner_name TEXT;

-- 1B. Shareable code links
CREATE TABLE IF NOT EXISTS public.shared_tag_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_tag_links ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own links
CREATE POLICY "Owner manages shared_tag_links"
  ON public.shared_tag_links
  FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Anyone authenticated can look up active codes (for joining)
CREATE POLICY "Authenticated users can read active links"
  ON public.shared_tag_links
  FOR SELECT
  USING (is_active = TRUE);

-- 1C. Membership table (who joined which shared tag)
CREATE TABLE IF NOT EXISTS public.shared_tag_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_tag_id TEXT NOT NULL,
  joiner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joiner_tag_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at TIMESTAMPTZ,
  CONSTRAINT unique_shared_membership UNIQUE (owner_tag_id, joiner_user_id)
);

ALTER TABLE public.shared_tag_memberships ENABLE ROW LEVEL SECURITY;

-- Owner can read and update memberships for their tags
CREATE POLICY "Owner manages memberships"
  ON public.shared_tag_memberships
  FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Joiner can read and update their own memberships
CREATE POLICY "Joiner manages own membership"
  ON public.shared_tag_memberships
  FOR ALL
  USING (auth.uid() = joiner_user_id)
  WITH CHECK (auth.uid() = joiner_user_id);

-- =============================================================
-- 1D. RPC: resolve_shared_tag_code
-- Validates code, checks self-invite and duplicate, returns tag info
-- =============================================================
CREATE OR REPLACE FUNCTION public.resolve_shared_tag_code(share_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_tag RECORD;
  v_profile RECORD;
  v_existing RECORD;
  v_caller_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Look up the active link
  SELECT * INTO v_link
    FROM shared_tag_links
   WHERE code = share_code AND is_active = TRUE
   LIMIT 1;

  IF v_link IS NULL THEN
    RETURN jsonb_build_object('error', 'Invalid or expired code');
  END IF;

  -- Self-invite check
  IF v_link.owner_user_id = v_caller_id THEN
    RETURN jsonb_build_object('error', 'Cannot join your own shared tag');
  END IF;

  -- Already joined check
  SELECT * INTO v_existing
    FROM shared_tag_memberships
   WHERE owner_tag_id = v_link.tag_id
     AND joiner_user_id = v_caller_id
     AND left_at IS NULL
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Already joined this shared tag');
  END IF;

  -- Fetch owner's tag info
  SELECT * INTO v_tag
    FROM session_tags
   WHERE id = v_link.tag_id
     AND user_id = v_link.owner_user_id
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_tag IS NULL THEN
    RETURN jsonb_build_object('error', 'Tag no longer exists');
  END IF;

  -- Fetch owner profile name
  SELECT display_name, avatar_color INTO v_profile
    FROM grove_profiles
   WHERE user_id = v_link.owner_user_id
   LIMIT 1;

  RETURN jsonb_build_object(
    'owner_user_id', v_link.owner_user_id,
    'owner_tag_id', v_link.tag_id,
    'tag_name', v_tag.name,
    'tag_icon', v_tag.icon,
    'tag_color', v_tag.color,
    'owner_display_name', COALESCE(v_profile.display_name, 'Unknown')
  );
END;
$$;

-- =============================================================
-- 1E. RPC: get_shared_tag_joiner_stats
-- Returns per-joiner daily focus stats for a shared tag
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_shared_tag_joiner_stats(
  p_owner_tag_id TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_user_tz TEXT DEFAULT 'UTC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_owner_tag RECORD;
  v_result JSONB := '[]'::JSONB;
  v_joiner RECORD;
  v_stats JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Verify caller owns this tag
  SELECT * INTO v_owner_tag
    FROM session_tags
   WHERE id = p_owner_tag_id
     AND user_id = v_caller_id
     AND is_sharing = TRUE
   LIMIT 1;

  IF v_owner_tag IS NULL THEN
    RETURN jsonb_build_object('error', 'Tag not found or not shared');
  END IF;

  -- Iterate over active joiners
  FOR v_joiner IN
    SELECT m.joiner_user_id, m.joiner_tag_id, m.id AS membership_id,
           p.display_name, p.avatar_color
      FROM shared_tag_memberships m
      LEFT JOIN grove_profiles p ON p.user_id = m.joiner_user_id
     WHERE m.owner_tag_id = p_owner_tag_id
       AND m.owner_user_id = v_caller_id
       AND m.left_at IS NULL
  LOOP
    -- Get daily stats for this joiner
    SELECT COALESCE(jsonb_agg(day_row ORDER BY day_row->>'day'), '[]'::JSONB)
      INTO v_stats
      FROM (
        SELECT jsonb_build_object(
          'day', d.day::TEXT,
          'total_minutes', COALESCE(SUM(fs.duration), 0),
          'session_count', COUNT(fs.id)
        ) AS day_row
        FROM generate_series(p_start_date, p_end_date, '1 day'::INTERVAL) AS d(day)
        LEFT JOIN focus_sessions fs
          ON fs.user_id = v_joiner.joiner_user_id
         AND fs.tag_id = v_joiner.joiner_tag_id
         AND (fs.start_time AT TIME ZONE p_user_tz)::DATE = d.day
         AND fs.duration > 0
        GROUP BY d.day
      ) sub;

    v_result := v_result || jsonb_build_object(
      'membership_id', v_joiner.membership_id,
      'joiner_user_id', v_joiner.joiner_user_id,
      'display_name', COALESCE(v_joiner.display_name, 'Unknown'),
      'avatar_color', v_joiner.avatar_color,
      'daily_stats', v_stats
    );
  END LOOP;

  RETURN v_result;
END;
$$;
