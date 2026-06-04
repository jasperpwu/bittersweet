-- Challenge Refactor Migration
-- Removes redundant streak tracking columns, adds period/target_minutes,
-- renames streak columns to hits, and replaces record_challenge_progress
-- with a derived-hits approach (counts all successful periods, not consecutive).

-- Step 1: Add new columns with defaults (safe for existing rows)
ALTER TABLE grove_challenges
  ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'daily'
    CHECK (period IN ('daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS target_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (target_minutes > 0);

-- Step 2: Backfill end_date for active challenges that only have streak_days
-- Guarded: only runs if streak_days column still exists (idempotent re-run safe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grove_challenges' AND column_name = 'streak_days'
  ) THEN
    UPDATE grove_challenges
    SET end_date = start_date + (streak_days - 1)
    WHERE status = 'active'
      AND end_date IS NULL
      AND start_date IS NOT NULL
      AND streak_days IS NOT NULL
      AND streak_days > 0;
  END IF;
END $$;

-- Step 3: Drop legacy columns
ALTER TABLE grove_challenges
  DROP COLUMN IF EXISTS streak_days,
  DROP COLUMN IF EXISTS repeat_until_date,
  DROP COLUMN IF EXISTS challenger_last_date,
  DROP COLUMN IF EXISTS challengee_last_date;

-- Step 3b: Rename streak columns to hits (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grove_challenges' AND column_name = 'challenger_streak'
  ) THEN
    ALTER TABLE grove_challenges RENAME COLUMN challenger_streak TO challenger_hits;
    ALTER TABLE grove_challenges RENAME COLUMN challengee_streak TO challengee_hits;
  END IF;
END $$;

-- Step 4: Helper function — count successful periods for a user
CREATE OR REPLACE FUNCTION _challenge_user_hits(
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
  hits INTEGER := 0;
  bucket RECORD;
BEGIN
  IF p_period = 'daily' THEN
    -- Daily buckets: count all days where target is met (non-consecutive)
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
      IF bucket.total_minutes >= p_target_minutes THEN
        hits := hits + 1;
      END IF;
    END LOOP;
  ELSE
    -- Weekly buckets: count all weeks where target is met (non-consecutive)
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
      IF bucket.total_minutes >= p_target_minutes THEN
        hits := hits + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN hits;
END;
$$;

-- Drop old function name if it exists
DROP FUNCTION IF EXISTS _challenge_user_streak(UUID, TEXT, DATE, DATE, TEXT, INTEGER, DATE, TEXT);

-- Step 5: Drop old record_challenge_progress RPC
DROP FUNCTION IF EXISTS record_challenge_progress(UUID, TEXT);

-- Step 6: Finalize expired challenges (called by daily cron)
CREATE OR REPLACE FUNCTION finalize_expired_challenges()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  challenge RECORD;
  v_challenger_hits INTEGER;
  v_challengee_hits INTEGER;
  v_total_periods INTEGER;
  v_new_status TEXT;
  v_finalized INTEGER := 0;
BEGIN
  FOR challenge IN
    SELECT * FROM grove_challenges
    WHERE status = 'active'
      AND end_date < CURRENT_DATE
  LOOP
    -- Compute both users' hits using existing helper
    v_challenger_hits := _challenge_user_hits(
      challenge.challenger_id, challenge.tag_id,
      challenge.start_date, challenge.end_date,
      challenge.period, challenge.target_minutes,
      challenge.end_date, 'UTC'
    );
    v_challengee_hits := _challenge_user_hits(
      challenge.challengee_id, challenge.tag_id,
      challenge.start_date, challenge.end_date,
      challenge.period, challenge.target_minutes,
      challenge.end_date, 'UTC'
    );

    -- Compute total periods
    IF challenge.period = 'daily' THEN
      v_total_periods := (challenge.end_date - challenge.start_date) + 1;
    ELSE
      v_total_periods := ((challenge.end_date - challenge.start_date) + 1) / 7;
    END IF;

    -- Both hit all periods → completed, otherwise → failed
    IF v_challenger_hits >= v_total_periods AND v_challengee_hits >= v_total_periods THEN
      v_new_status := 'completed';
    ELSE
      v_new_status := 'failed';
    END IF;

    UPDATE grove_challenges
    SET status = v_new_status,
        challenger_hits = v_challenger_hits,
        challengee_hits = v_challengee_hits,
        updated_at = now()
    WHERE id = challenge.id;

    v_finalized := v_finalized + 1;
  END LOOP;

  RETURN json_build_object('finalized', v_finalized);
END;
$$;
