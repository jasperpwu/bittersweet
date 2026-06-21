-- Migration: per-individual challenge rewards + claim tracking
--
-- Challenge results are now individual: each participant completes (and earns the
-- fruit reward) based on whether THEY hit every period, independent of the other
-- participants. The shared grove_challenges.status stays as-is (an aggregate); the
-- per-user truth already lives in grove_challenge_participants.outcome, which the
-- client now drives its result off of.
--
-- This migration adds the missing piece — claim tracking — so a winner can claim
-- their fruits exactly once. reward_claimed_at is the idempotency guard (survives
-- reinstalls/devices). Eligibility (challenge over + I hit all periods) is decided
-- client-side and trusted here, mirroring the trust-client-hits approach of
-- migration 20260606; the RPC just records the claim race-safely.

-- 1. Per-participant claim timestamp.
ALTER TABLE grove_challenge_participants
  ADD COLUMN IF NOT EXISTS reward_claimed_at TIMESTAMPTZ;

-- 2. Expose reward_claimed_at from the co-participant RPC (read by fetchChallenges).
--    DROP first: CREATE OR REPLACE cannot change a function's RETURNS TABLE shape.
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
  reward_claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT cp.id, cp.challenge_id, cp.user_id, cp.role, cp.status,
           cp.hits, cp.outcome, cp.tag_id, cp.reward_claimed_at,
           cp.created_at, cp.updated_at
    FROM grove_challenge_participants cp
    WHERE cp.challenge_id = ANY(p_challenge_ids)
      AND EXISTS (
        SELECT 1 FROM grove_challenge_participants cp2
        WHERE cp2.challenge_id = cp.challenge_id
          AND cp2.user_id = auth.uid()
      );
END;
$$;

-- 3. Claim RPC. Idempotent and race-safe via the conditional UPDATE: only the first
--    caller flips reward_claimed_at from NULL, so fruits are credited exactly once.
--    Returns { claimed, fruit_reward } — claimed is true only on that first claim.
CREATE OR REPLACE FUNCTION claim_challenge_reward(p_challenge_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_participant_id UUID;
  v_fruit_reward INTEGER;
BEGIN
  -- Caller's own participant row for this challenge.
  SELECT id INTO v_participant_id
  FROM grove_challenge_participants
  WHERE challenge_id = p_challenge_id
    AND user_id = auth.uid();

  IF v_participant_id IS NULL THEN
    RAISE EXCEPTION 'Not a participant of this challenge';
  END IF;

  SELECT fruit_reward INTO v_fruit_reward
  FROM grove_challenges
  WHERE id = p_challenge_id;

  -- Record the claim only if it was not already claimed. Also stamp outcome so the
  -- record is consistent even if the finalize cron has not run yet.
  UPDATE grove_challenge_participants
  SET reward_claimed_at = now(),
      outcome = 'completed',
      updated_at = now()
  WHERE id = v_participant_id
    AND reward_claimed_at IS NULL;

  IF NOT FOUND THEN
    -- Already claimed (or lost a concurrent race): no fresh credit.
    RETURN json_build_object('claimed', false, 'fruit_reward', COALESCE(v_fruit_reward, 0));
  END IF;

  RETURN json_build_object('claimed', true, 'fruit_reward', COALESCE(v_fruit_reward, 0));
END;
$$;

-- 4. Slim down the cron. Now that each participant's result is derived on the client
--    (from their own timezone-aware hits) and the reward is recorded by
--    claim_challenge_reward, finalize_expired_challenges no longer needs to stamp
--    outcomes or flip the shared status to completed/failed — the client ignored both.
--    Its sole remaining job is the auto-cancel lifecycle transition (a pending
--    challenge past its start_date that no invitee accepted -> cancelled), which is
--    shared state the client reads. Other participants' Done/Failed badges are now
--    derived client-side from hits, so dropping the outcome-stamping loses nothing.
--    Keeps the function name so the deployed challenge-cron edge function is unchanged.
CREATE OR REPLACE FUNCTION finalize_expired_challenges()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  challenge RECORD;
  v_cancelled INTEGER := 0;
  v_accepted_count INTEGER;
BEGIN
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

  -- 'finalized' kept (always 0) for the edge function's existing logging.
  RETURN json_build_object('finalized', 0, 'cancelled', v_cancelled);
END;
$$;
