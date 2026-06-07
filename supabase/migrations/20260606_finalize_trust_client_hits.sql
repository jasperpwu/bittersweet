-- Migration: finalize_expired_challenges trusts client-computed hits
--
-- Previously the cron recalculated hits server-side with hardcoded 'UTC' timezone,
-- overwriting the correct timezone-aware hits computed by the client.
-- Now the cron simply reads the hits already stored on participant rows
-- (written by the client via updateMyHits after each focus session)
-- and only determines outcome + challenge status.
--
-- Safety: uses end_date < CURRENT_DATE - 2 to ensure the challenge's last day
-- has fully elapsed in every timezone (UTC+14 is the furthest ahead).

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
      UPDATE grove_challenges
      SET status = 'active', updated_at = now()
      WHERE id = challenge.id;
    END IF;
  END LOOP;

  -- Phase 2: Finalize expired active challenges
  -- Wait 2 days past end_date so the last day has fully elapsed in all timezones (up to UTC+14)
  FOR challenge IN
    SELECT * FROM grove_challenges
    WHERE status = 'active'
      AND end_date < CURRENT_DATE - 2
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
