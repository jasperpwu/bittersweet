-- Migration: stop toggling challenges to 'active'; derive "active" on the client
--
-- "Active" was a stored state the daily cron flipped on (pending -> active) once
-- start_date arrived. That coupled two unrelated things: whether a participant
-- has accepted, and whether the challenge has begun counting. The client now
-- derives both (see GroveChallengeService.fetchChallenges): a challenge is
-- active for a participant the moment their own row is accepted, and hits are
-- counted from start_date via the date-range hit math — no server toggle needed.
--
-- This rewrites finalize_expired_challenges():
--   * Phase 1 keeps only the auto-cancel branch (pending past start_date with
--     zero accepted invitees -> cancelled). The activate branch is removed.
--   * Phase 2 no longer keys off the stored status = 'active'. Live challenges
--     stay status = 'pending' in the DB now, so it finalizes any non-terminal
--     challenge past end_date that actually has an accepted invitee.
--
-- Safety: end_date < CURRENT_DATE - 2 ensures the last day has fully elapsed in
-- every timezone (UTC+14 is the furthest ahead). Client-computed hits are
-- trusted as-is (timezone-aware), matching 20260606.

CREATE OR REPLACE FUNCTION finalize_expired_challenges()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  challenge RECORD;
  participant RECORD;
  v_total_periods INTEGER;
  v_all_completed BOOLEAN;
  v_new_status TEXT;
  v_finalized INTEGER := 0;
  v_cancelled INTEGER := 0;
  v_accepted_count INTEGER;
BEGIN
  -- Phase 1: Auto-cancel pending challenges past start_date with zero accepted invitees.
  -- (No activation branch: an accepted challenge simply stays 'pending' in the DB
  --  and is treated as active on the client until Phase 2 finalizes it.)
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
    END IF;
  END LOOP;

  -- Phase 2: Finalize expired challenges (past end_date) that have an accepted invitee.
  -- Selects on "not terminal" rather than status = 'active', since live challenges
  -- are no longer toggled to 'active'. The accepted-invitee guard avoids vacuously
  -- marking a participant-less challenge as 'completed'.
  -- Wait 2 days past end_date so the last day has fully elapsed in all timezones (up to UTC+14).
  FOR challenge IN
    SELECT * FROM grove_challenges c
    WHERE c.status NOT IN ('completed', 'failed', 'cancelled')
      AND c.end_date < CURRENT_DATE - 2
      AND EXISTS (
        SELECT 1 FROM grove_challenge_participants cp
        WHERE cp.challenge_id = c.id
          AND cp.role = 'invitee'
          AND cp.status = 'accepted'
      )
  LOOP
    IF challenge.period = 'daily' THEN
      v_total_periods := (challenge.end_date - challenge.start_date) + 1;
    ELSE
      v_total_periods := ((challenge.end_date - challenge.start_date) + 1) / 7;
    END IF;

    v_all_completed := TRUE;

    FOR participant IN
      SELECT * FROM grove_challenge_participants
      WHERE challenge_id = challenge.id
        AND status = 'accepted'
    LOOP
      -- Use client-computed hits (already timezone-aware) instead of recalculating
      UPDATE grove_challenge_participants
      SET outcome = CASE WHEN participant.hits >= v_total_periods THEN 'completed' ELSE 'failed' END,
          updated_at = now()
      WHERE id = participant.id;

      IF participant.hits < v_total_periods THEN
        v_all_completed := FALSE;
      END IF;
    END LOOP;

    v_new_status := CASE WHEN v_all_completed THEN 'completed' ELSE 'failed' END;

    UPDATE grove_challenges
    SET status = v_new_status, updated_at = now()
    WHERE id = challenge.id;

    v_finalized := v_finalized + 1;
  END LOOP;

  RETURN json_build_object('finalized', v_finalized, 'cancelled', v_cancelled);
END;
$$;
