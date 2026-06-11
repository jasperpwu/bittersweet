-- Migration: per-participant challenge tag
--
-- Previously a challenge stored a single tag_id (the creator's local tag id) and
-- every participant's progress was matched against it. But session_tags.id is a
-- globally-unique per-user primary key, so an invitee's tag never shares the
-- creator's id and their sessions could never match. Each participant now maps
-- the challenge to their OWN local tag id, stored on their participant row.

-- 1. Per-participant tag column
ALTER TABLE grove_challenge_participants
  ADD COLUMN IF NOT EXISTS tag_id TEXT;

-- 2. Backfill: creators already focus with the challenge's tag, so seed their row.
--    Invitee rows stay NULL until they accept and pick/create a tag.
UPDATE grove_challenge_participants cp
SET tag_id = c.tag_id
FROM grove_challenges c
WHERE cp.challenge_id = c.id
  AND cp.role = 'creator'
  AND cp.tag_id IS NULL;

-- 3. Expose tag_id from the co-participant RPC (used by fetchChallenges).
-- DROP first: CREATE OR REPLACE cannot change a function's RETURNS TABLE shape.
DROP FUNCTION IF EXISTS get_challenge_participants(UUID[]);
CREATE FUNCTION get_challenge_participants(p_challenge_ids UUID[])
RETURNS TABLE (
  id UUID,
  challenge_id UUID,
  user_id UUID,
  role TEXT,
  status TEXT,
  hits INTEGER,
  outcome TEXT,
  tag_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT cp.id, cp.challenge_id, cp.user_id, cp.role, cp.status,
           cp.hits, cp.outcome, cp.tag_id, cp.created_at, cp.updated_at
    FROM grove_challenge_participants cp
    WHERE cp.challenge_id = ANY(p_challenge_ids)
      AND EXISTS (
        SELECT 1 FROM grove_challenge_participants cp2
        WHERE cp2.challenge_id = cp.challenge_id
          AND cp2.user_id = auth.uid()
      );
END;
$$;

-- 4. Period-details grid now counts each participant's sessions against THEIR
--    own tag id (falling back to the challenge's tag id for legacy rows).
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
  v_tag_id TEXT;
BEGIN
  SELECT * INTO v_challenge FROM grove_challenges WHERE id = p_challenge_id;
  IF v_challenge IS NULL THEN
    RETURN json_build_object('periods', '[]'::json, 'participants', '[]'::json, 'total_periods', 0);
  END IF;

  IF v_challenge.period = 'daily' THEN
    v_period_dates := ARRAY(
      SELECT generate_series(v_challenge.start_date, v_challenge.end_date, '1 day'::interval)::date
    );
  ELSE
    v_period_dates := ARRAY(
      SELECT generate_series(v_challenge.start_date, v_challenge.end_date, '7 days'::interval)::date
    );
  END IF;

  v_total_periods := COALESCE(array_length(v_period_dates, 1), 0);
  v_participants := ARRAY[]::JSON[];

  FOR v_participant IN
    SELECT cp.user_id, cp.role, cp.status, cp.hits, cp.outcome, cp.tag_id
    FROM grove_challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
      AND cp.status = 'accepted'
    ORDER BY cp.role ASC, cp.created_at ASC
  LOOP
    SELECT * INTO v_profile FROM grove_profiles WHERE user_id = v_participant.user_id;
    v_tag_id := COALESCE(v_participant.tag_id, v_challenge.tag_id);
    v_minutes := ARRAY[]::INTEGER[];
    v_hits := 0;

    FOR i IN 1..COALESCE(v_total_periods, 0) LOOP
      v_period_date := v_period_dates[i];
      IF v_challenge.period = 'daily' THEN
        SELECT COALESCE(SUM(COALESCE(fs.adjusted_duration, fs.duration)), 0)::INTEGER INTO v_total_minutes
        FROM focus_sessions fs
        WHERE fs.user_id = v_participant.user_id
          AND fs.tag_id = v_tag_id
          AND fs.deleted_at IS NULL
          AND (fs.start_time AT TIME ZONE p_user_tz)::date = v_period_date;
      ELSE
        SELECT COALESCE(SUM(COALESCE(fs.adjusted_duration, fs.duration)), 0)::INTEGER INTO v_total_minutes
        FROM focus_sessions fs
        WHERE fs.user_id = v_participant.user_id
          AND fs.tag_id = v_tag_id
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
