-- Multi-Participant Challenges Migration
-- Adds grove_challenge_participants table, backfills existing 1v1 data,
-- updates finalize_expired_challenges() and get_challenge_period_details() RPCs.

-- ============================================================
-- Step 1a: Add creator_id to grove_challenges + 'cancelled' status
-- ============================================================

ALTER TABLE grove_challenges
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill creator_id from challenger_id
UPDATE grove_challenges SET creator_id = challenger_id WHERE creator_id IS NULL;

-- Make creator_id NOT NULL after backfill
ALTER TABLE grove_challenges ALTER COLUMN creator_id SET NOT NULL;

-- Update status CHECK to include 'cancelled'
ALTER TABLE grove_challenges DROP CONSTRAINT IF EXISTS grove_challenges_status_check;
ALTER TABLE grove_challenges ADD CONSTRAINT grove_challenges_status_check
  CHECK (status IN ('pending', 'active', 'completed', 'failed', 'declined', 'cancelled'));

-- ============================================================
-- Step 1b: Create grove_challenge_participants table
-- ============================================================

CREATE TABLE IF NOT EXISTS grove_challenge_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES grove_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('creator', 'invitee')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  hits INTEGER NOT NULL DEFAULT 0,
  outcome TEXT CHECK (outcome IN ('completed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_challenge_participant UNIQUE (challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge
  ON grove_challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user
  ON grove_challenge_participants(user_id, status);

ALTER TABLE grove_challenge_participants ENABLE ROW LEVEL SECURITY;

-- Users can view their own participant rows directly.
-- Co-participant data is fetched via a SECURITY DEFINER RPC or by
-- querying participants after discovering challenge IDs through grove_challenges.
CREATE POLICY "Users can view own participant rows" ON grove_challenge_participants FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own participant row
CREATE POLICY "Users can update own participant row" ON grove_challenge_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Creator can insert participants (via the challenge's creator_id)
CREATE POLICY "Creator can insert participants" ON grove_challenge_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM grove_challenges c
      WHERE c.id = grove_challenge_participants.challenge_id
        AND c.creator_id = auth.uid()
    )
  );

-- Creator can delete participants (for cancelled challenges)
CREATE POLICY "Creator can delete participants" ON grove_challenge_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM grove_challenges c
      WHERE c.id = grove_challenge_participants.challenge_id
        AND c.creator_id = auth.uid()
    )
  );

-- ============================================================
-- Step 1c: Backfill existing 1v1 challenges into participants table
-- ============================================================

-- Insert challenger as creator (accepted)
INSERT INTO grove_challenge_participants (challenge_id, user_id, role, status, hits, created_at, updated_at)
SELECT
  id, challenger_id, 'creator', 'accepted', challenger_hits, created_at, updated_at
FROM grove_challenges
WHERE NOT EXISTS (
  SELECT 1 FROM grove_challenge_participants cp
  WHERE cp.challenge_id = grove_challenges.id AND cp.user_id = grove_challenges.challenger_id
)
ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- Insert challengee as invitee with mapped status
INSERT INTO grove_challenge_participants (challenge_id, user_id, role, status, hits, created_at, updated_at)
SELECT
  id,
  challengee_id,
  'invitee',
  CASE
    WHEN status IN ('active', 'completed', 'failed') THEN 'accepted'
    WHEN status = 'declined' THEN 'declined'
    ELSE 'pending'
  END,
  challengee_hits,
  created_at,
  updated_at
FROM grove_challenges
WHERE NOT EXISTS (
  SELECT 1 FROM grove_challenge_participants cp
  WHERE cp.challenge_id = grove_challenges.id AND cp.user_id = grove_challenges.challengee_id
)
ON CONFLICT (challenge_id, user_id) DO NOTHING;

-- ============================================================
-- Step 1d: Update RLS on grove_challenges
-- ============================================================

-- Drop old RLS policies
DROP POLICY IF EXISTS "Users can view own challenges" ON grove_challenges;
DROP POLICY IF EXISTS "Users can create challenges" ON grove_challenges;
DROP POLICY IF EXISTS "Users can update own challenges" ON grove_challenges;

-- SELECT: creator can always see their challenges;
-- other participants see challenges they have a participant row for.
CREATE POLICY "Users can view own challenges" ON grove_challenges FOR SELECT
  USING (
    auth.uid() = creator_id
    OR EXISTS (
      SELECT 1 FROM grove_challenge_participants cp
      WHERE cp.challenge_id = grove_challenges.id
        AND cp.user_id = auth.uid()
    )
  );

-- INSERT: only creator
CREATE POLICY "Users can create challenges" ON grove_challenges FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- UPDATE: only creator
CREATE POLICY "Creator can update challenges" ON grove_challenges FOR UPDATE
  USING (auth.uid() = creator_id);

-- DELETE: only creator (for cancelled challenges)
CREATE POLICY "Creator can delete challenges" ON grove_challenges FOR DELETE
  USING (auth.uid() = creator_id);

-- ============================================================
-- Step 1d2: RPC to fetch all participants for challenges the caller belongs to.
-- Bypasses per-row RLS so co-participants are visible.
-- ============================================================

CREATE OR REPLACE FUNCTION get_challenge_participants(p_challenge_ids UUID[])
RETURNS TABLE (
  id UUID,
  challenge_id UUID,
  user_id UUID,
  role TEXT,
  status TEXT,
  hits INTEGER,
  outcome TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT cp.id, cp.challenge_id, cp.user_id, cp.role, cp.status,
           cp.hits, cp.outcome, cp.created_at, cp.updated_at
    FROM grove_challenge_participants cp
    WHERE cp.challenge_id = ANY(p_challenge_ids)
      -- Only return participants for challenges the caller actually belongs to
      AND EXISTS (
        SELECT 1 FROM grove_challenge_participants cp2
        WHERE cp2.challenge_id = cp.challenge_id
          AND cp2.user_id = auth.uid()
      );
END;
$$;

-- ============================================================
-- Step 1e: Updated finalize_expired_challenges()
-- Now handles: auto-cancel pending challenges past start_date with no accepted invitees,
-- and per-participant outcome for expired active challenges.
-- ============================================================

CREATE OR REPLACE FUNCTION finalize_expired_challenges()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  challenge RECORD;
  participant RECORD;
  v_hits INTEGER;
  v_total_periods INTEGER;
  v_all_completed BOOLEAN;
  v_new_status TEXT;
  v_finalized INTEGER := 0;
  v_cancelled INTEGER := 0;
  v_accepted_count INTEGER;
BEGIN
  -- Phase 1: Auto-cancel pending challenges past start_date with zero accepted invitees
  FOR challenge IN
    SELECT * FROM grove_challenges
    WHERE status = 'pending'
      AND start_date IS NOT NULL
      AND start_date <= CURRENT_DATE
  LOOP
    SELECT COUNT(*) INTO v_accepted_count
    FROM grove_challenge_participants
    WHERE challenge_id = challenge.id
      AND role = 'invitee'
      AND status = 'accepted';

    IF v_accepted_count = 0 THEN
      UPDATE grove_challenges
      SET status = 'cancelled', updated_at = now()
      WHERE id = challenge.id;

      v_cancelled := v_cancelled + 1;
    ELSE
      -- Has accepted invitees: activate the challenge
      UPDATE grove_challenges
      SET status = 'active', updated_at = now()
      WHERE id = challenge.id;
    END IF;
  END LOOP;

  -- Phase 2: Finalize expired active challenges (past end_date)
  FOR challenge IN
    SELECT * FROM grove_challenges
    WHERE status = 'active'
      AND end_date < CURRENT_DATE
  LOOP
    -- Compute total periods
    IF challenge.period = 'daily' THEN
      v_total_periods := (challenge.end_date - challenge.start_date) + 1;
    ELSE
      v_total_periods := ((challenge.end_date - challenge.start_date) + 1) / 7;
    END IF;

    v_all_completed := TRUE;

    -- Update per-participant hits and outcome
    FOR participant IN
      SELECT * FROM grove_challenge_participants
      WHERE challenge_id = challenge.id
        AND status = 'accepted'
    LOOP
      v_hits := _challenge_user_hits(
        participant.user_id, challenge.tag_id,
        challenge.start_date, challenge.end_date,
        challenge.period, challenge.target_minutes,
        challenge.end_date, 'UTC'
      );

      UPDATE grove_challenge_participants
      SET hits = v_hits,
          outcome = CASE WHEN v_hits >= v_total_periods THEN 'completed' ELSE 'failed' END,
          updated_at = now()
      WHERE id = participant.id;

      IF v_hits < v_total_periods THEN
        v_all_completed := FALSE;
      END IF;
    END LOOP;

    -- Set challenge-level status
    v_new_status := CASE WHEN v_all_completed THEN 'completed' ELSE 'failed' END;

    UPDATE grove_challenges
    SET status = v_new_status,
        updated_at = now()
    WHERE id = challenge.id;

    -- Also update legacy columns for backward compat during transition
    UPDATE grove_challenges
    SET challenger_hits = COALESCE(
          (SELECT hits FROM grove_challenge_participants
           WHERE challenge_id = challenge.id AND user_id = challenge.challenger_id), 0),
        challengee_hits = COALESCE(
          (SELECT hits FROM grove_challenge_participants
           WHERE challenge_id = challenge.id AND user_id = challenge.challengee_id), 0)
    WHERE id = challenge.id;

    v_finalized := v_finalized + 1;
  END LOOP;

  RETURN json_build_object('finalized', v_finalized, 'cancelled', v_cancelled);
END;
$$;

-- ============================================================
-- Step 1f: Updated get_challenge_period_details() RPC
-- Returns new shape with per-participant minutes arrays.
-- ============================================================

CREATE OR REPLACE FUNCTION get_challenge_period_details(
  p_challenge_id UUID,
  p_user_tz TEXT DEFAULT 'UTC'
)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_challenge grove_challenges%ROWTYPE;
  v_period_dates DATE[];
  v_period_date DATE;
  v_participant RECORD;
  v_participants JSON[];
  v_minutes INTEGER[];
  v_total_minutes INTEGER;
  v_total_periods INTEGER;
  v_profile grove_profiles%ROWTYPE;
  v_hits INTEGER;
BEGIN
  SELECT * INTO v_challenge FROM grove_challenges WHERE id = p_challenge_id;
  IF v_challenge IS NULL THEN
    RETURN json_build_object('periods', '[]'::json, 'participants', '[]'::json, 'total_periods', 0);
  END IF;

  -- Build period dates array
  IF v_challenge.period = 'daily' THEN
    v_period_dates := ARRAY(
      SELECT generate_series(v_challenge.start_date, v_challenge.end_date, '1 day'::interval)::date
    );
  ELSE
    v_period_dates := ARRAY(
      SELECT generate_series(v_challenge.start_date, v_challenge.end_date, '7 days'::interval)::date
    );
  END IF;

  v_total_periods := array_length(v_period_dates, 1);
  IF v_total_periods IS NULL THEN v_total_periods := 0; END IF;

  -- Build per-participant data
  v_participants := ARRAY[]::JSON[];

  FOR v_participant IN
    SELECT cp.user_id, cp.role, cp.status, cp.hits, cp.outcome
    FROM grove_challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
      AND cp.status = 'accepted'
    ORDER BY cp.role ASC, cp.created_at ASC
  LOOP
    -- Get profile
    SELECT * INTO v_profile FROM grove_profiles WHERE user_id = v_participant.user_id;

    -- Compute minutes per period
    v_minutes := ARRAY[]::INTEGER[];
    v_hits := 0;

    FOR i IN 1..COALESCE(v_total_periods, 0) LOOP
      v_period_date := v_period_dates[i];

      IF v_challenge.period = 'daily' THEN
        SELECT COALESCE(SUM(COALESCE(fs.adjusted_duration, fs.duration)), 0)::INTEGER INTO v_total_minutes
        FROM focus_sessions fs
        WHERE fs.user_id = v_participant.user_id
          AND fs.tag_id = v_challenge.tag_id
          AND fs.deleted_at IS NULL
          AND (fs.start_time AT TIME ZONE p_user_tz)::date = v_period_date;
      ELSE
        SELECT COALESCE(SUM(COALESCE(fs.adjusted_duration, fs.duration)), 0)::INTEGER INTO v_total_minutes
        FROM focus_sessions fs
        WHERE fs.user_id = v_participant.user_id
          AND fs.tag_id = v_challenge.tag_id
          AND fs.deleted_at IS NULL
          AND (fs.start_time AT TIME ZONE p_user_tz)::date >= v_period_date
          AND (fs.start_time AT TIME ZONE p_user_tz)::date < v_period_date + 7;
      END IF;

      v_minutes := v_minutes || v_total_minutes;
      IF v_total_minutes >= v_challenge.target_minutes THEN
        v_hits := v_hits + 1;
      END IF;
    END LOOP;

    v_participants := v_participants || json_build_object(
      'user_id', v_participant.user_id,
      'display_name', COALESCE(v_profile.display_name, 'Unknown'),
      'minutes', to_json(v_minutes),
      'hits', v_hits
    );
  END LOOP;

  RETURN json_build_object(
    'periods', to_json(v_period_dates),
    'participants', to_json(v_participants),
    'total_periods', v_total_periods
  );
END;
$$;
