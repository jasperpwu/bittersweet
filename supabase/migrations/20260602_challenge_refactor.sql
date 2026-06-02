-- Challenge Refactor Migration
-- Removes redundant streak tracking columns, adds period/target_minutes,
-- and replaces record_challenge_progress with a derived-streak approach.

-- Step 1: Add new columns with defaults (safe for existing rows)
ALTER TABLE grove_challenges
  ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'daily'
    CHECK (period IN ('daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS target_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (target_minutes > 0);

-- Step 2: Backfill end_date for active challenges that only have streak_days
UPDATE grove_challenges
SET end_date = start_date + (streak_days - 1)
WHERE status = 'active'
  AND end_date IS NULL
  AND start_date IS NOT NULL
  AND streak_days IS NOT NULL
  AND streak_days > 0;

-- Step 3: Drop legacy columns
ALTER TABLE grove_challenges
  DROP COLUMN IF EXISTS streak_days,
  DROP COLUMN IF EXISTS repeat_until_date,
  DROP COLUMN IF EXISTS challenger_last_date,
  DROP COLUMN IF EXISTS challengee_last_date;

-- Step 4: Helper function — compute a user's streak from focus_sessions
CREATE OR REPLACE FUNCTION _challenge_user_streak(
  p_user_id UUID,
  p_tag_id TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_period TEXT,       -- 'daily' or 'weekly'
  p_target_minutes INTEGER,
  p_as_of_date DATE,   -- usually CURRENT_DATE in user's timezone
  p_user_tz TEXT DEFAULT 'UTC'
)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  streak INTEGER := 0;
  bucket RECORD;
  expected_idx INTEGER := 0;
BEGIN
  IF p_period = 'daily' THEN
    -- Daily buckets: each calendar day in user's timezone
    FOR bucket IN
      SELECT
        (fs.start_time AT TIME ZONE p_user_tz)::date AS bucket_date,
        SUM(COALESCE(fs.adjusted_duration, fs.duration)) AS total_minutes
      FROM focus_sessions fs
      WHERE fs.user_id = p_user_id
        AND fs.tag_id = p_tag_id
        AND fs.deleted_at IS NULL
        AND (fs.start_time AT TIME ZONE p_user_tz)::date >= p_start_date
        AND (fs.start_time AT TIME ZONE p_user_tz)::date <= LEAST(p_end_date, p_as_of_date)
      GROUP BY bucket_date
      ORDER BY bucket_date
    LOOP
      -- Check this bucket is the expected consecutive day
      IF bucket.bucket_date <> p_start_date + expected_idx THEN
        EXIT; -- gap found, stop counting
      END IF;
      IF bucket.total_minutes >= p_target_minutes THEN
        streak := streak + 1;
        expected_idx := expected_idx + 1;
      ELSE
        EXIT; -- target not met, stop counting
      END IF;
    END LOOP;
  ELSE
    -- Weekly buckets: ISO weeks (Mon-Sun)
    FOR bucket IN
      SELECT
        date_trunc('week', (fs.start_time AT TIME ZONE p_user_tz)::date)::date AS week_start,
        SUM(COALESCE(fs.adjusted_duration, fs.duration)) AS total_minutes
      FROM focus_sessions fs
      WHERE fs.user_id = p_user_id
        AND fs.tag_id = p_tag_id
        AND fs.deleted_at IS NULL
        AND (fs.start_time AT TIME ZONE p_user_tz)::date >= p_start_date
        AND (fs.start_time AT TIME ZONE p_user_tz)::date <= LEAST(p_end_date, p_as_of_date)
      GROUP BY week_start
      ORDER BY week_start
    LOOP
      -- Expected week_start = challenge start_date's week + expected_idx weeks
      IF bucket.week_start <> date_trunc('week', p_start_date)::date + (expected_idx * 7) THEN
        EXIT;
      END IF;
      IF bucket.total_minutes >= p_target_minutes THEN
        streak := streak + 1;
        expected_idx := expected_idx + 1;
      ELSE
        EXIT;
      END IF;
    END LOOP;
  END IF;

  RETURN streak;
END;
$$;

-- Step 5: Replace record_challenge_progress RPC
CREATE OR REPLACE FUNCTION record_challenge_progress(
  challenge_id UUID,
  user_tz TEXT DEFAULT 'UTC'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  challenge grove_challenges%ROWTYPE;
  today DATE;
  challenger_streak INTEGER;
  challengee_streak INTEGER;
  total_periods INTEGER;
BEGIN
  SELECT * INTO challenge FROM grove_challenges
  WHERE id = challenge_id AND status = 'active';

  IF challenge IS NULL THEN
    RETURN json_build_object('error', 'CHALLENGE_NOT_FOUND');
  END IF;

  today := (now() AT TIME ZONE user_tz)::date;

  -- Compute streaks from focus_sessions
  challenger_streak := _challenge_user_streak(
    challenge.challenger_id, challenge.tag_id,
    challenge.start_date, challenge.end_date,
    challenge.period, challenge.target_minutes,
    today, user_tz
  );
  challengee_streak := _challenge_user_streak(
    challenge.challengee_id, challenge.tag_id,
    challenge.start_date, challenge.end_date,
    challenge.period, challenge.target_minutes,
    today, user_tz
  );

  -- Compute total periods
  IF challenge.period = 'daily' THEN
    total_periods := (challenge.end_date - challenge.start_date) + 1;
  ELSE
    total_periods := ((challenge.end_date - challenge.start_date) + 1) / 7;
  END IF;

  -- If past end_date: finalize
  IF today >= challenge.end_date THEN
    IF challenger_streak >= total_periods AND challengee_streak >= total_periods THEN
      UPDATE grove_challenges
      SET status = 'completed',
          challenger_streak = record_challenge_progress.challenger_streak,
          challengee_streak = record_challenge_progress.challengee_streak,
          updated_at = now()
      WHERE id = challenge_id;

      RETURN json_build_object(
        'status', 'completed',
        'challenger_streak', challenger_streak,
        'challengee_streak', challengee_streak,
        'total_periods', total_periods,
        'reward', challenge.fruit_reward
      );
    ELSE
      UPDATE grove_challenges
      SET status = 'failed',
          challenger_streak = record_challenge_progress.challenger_streak,
          challengee_streak = record_challenge_progress.challengee_streak,
          updated_at = now()
      WHERE id = challenge_id;

      RETURN json_build_object(
        'status', 'failed',
        'challenger_streak', challenger_streak,
        'challengee_streak', challengee_streak,
        'total_periods', total_periods
      );
    END IF;
  END IF;

  -- Still in progress — return computed streaks without writing
  RETURN json_build_object(
    'status', 'progress',
    'challenger_streak', challenger_streak,
    'challengee_streak', challengee_streak,
    'total_periods', total_periods
  );
END;
$$;
