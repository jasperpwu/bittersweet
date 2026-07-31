-- Migration: challenge reward redefinition + isolated/pooled reward mode
--
-- The flat `fruit_reward` bounty (default 10) is replaced by a proportional
-- reward: a finished challenge doubles the fruits the participant actually
-- earned with the challenge tag during the challenge window.
--
--   every period hit    -> x1.00  (a full 100% double)
--   anything short      -> ratio x 0.80  (80% completion => 0.8*0.8 = 0.64)
--
-- reward_mode decides whose record produces `ratio`:
--   'isolated' -- the claimant's own hits only (default; matches existing rows).
--   'pooled'   -- participants are bound: the undiscounted x1.00 is paid only if
--                 EVERY accepted participant hit EVERY period, otherwise the
--                 group's average completion drops everyone into the 80% band.
--                 The base stays each participant's own fruits. Pooled also adds
--                 an unconditional +10% of your own fruits for personally hitting
--                 every period, so pooled tops out at x1.10 vs isolated's x1.00.
--
-- Per-session fruits are deliberately not synced to the cloud (migration
-- 20260620), so only the owning device can total the base. The amount is
-- therefore computed client-side and passed to claim_challenge_reward, the same
-- trust-the-client model already used for hits (20260606). reward_claimed_at
-- remains the idempotency guard, so a claim can still only be credited once.

-- 1. Reward mode on the challenge. Existing rows keep the per-individual
--    behaviour they already had.
ALTER TABLE grove_challenges
  ADD COLUMN IF NOT EXISTS reward_mode TEXT NOT NULL DEFAULT 'isolated'
    CHECK (reward_mode IN ('isolated', 'pooled'));

-- 2. What each participant actually claimed. NULL until claimed; kept so the UI
--    can show the historical payout without recomputing it from sessions that
--    may since have been edited or deleted.
ALTER TABLE grove_challenge_participants
  ADD COLUMN IF NOT EXISTS reward_amount INTEGER;

-- 3. Expose reward_amount from the co-participant RPC (read by fetchChallenges).
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
  reward_amount INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
    SELECT cp.id, cp.challenge_id, cp.user_id, cp.role, cp.status,
           cp.hits, cp.outcome, cp.tag_id, cp.reward_claimed_at, cp.reward_amount,
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

-- 4. Claim RPC now records a client-computed amount.
--    Still idempotent and race-safe via the conditional UPDATE on
--    reward_claimed_at: only the first caller flips it from NULL, so fruits are
--    credited exactly once. p_amount defaults to NULL so an older client calling
--    with only p_challenge_id still resolves here and falls back to the legacy
--    flat fruit_reward instead of erroring.
--
--    DROP the single-argument version first: leaving it alongside a two-argument
--    version with a defaulted parameter makes a one-argument call ambiguous
--    (Postgres errors rather than picking one).
DROP FUNCTION IF EXISTS claim_challenge_reward(UUID);
CREATE OR REPLACE FUNCTION claim_challenge_reward(
  p_challenge_id UUID,
  p_amount INTEGER DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_participant_id UUID;
  v_reward INTEGER;
  v_existing INTEGER;
BEGIN
  -- Caller's own participant row for this challenge.
  SELECT id, reward_amount INTO v_participant_id, v_existing
  FROM grove_challenge_participants
  WHERE challenge_id = p_challenge_id
    AND user_id = auth.uid();

  IF v_participant_id IS NULL THEN
    RAISE EXCEPTION 'Not a participant of this challenge';
  END IF;

  IF p_amount IS NULL THEN
    SELECT fruit_reward INTO v_reward FROM grove_challenges WHERE id = p_challenge_id;
  ELSE
    v_reward := GREATEST(p_amount, 0);
  END IF;

  -- Record the claim only if it was not already claimed.
  --
  -- Unlike the previous version this no longer stamps outcome = 'completed':
  -- a partial run is now claimable too, and stamping it would make
  -- fetchChallenges (which trusts a stored outcome over its own derivation)
  -- badge an 80% run as "Done". Outcome stays client-derived from hits.
  UPDATE grove_challenge_participants
  SET reward_claimed_at = now(),
      reward_amount = COALESCE(v_reward, 0),
      updated_at = now()
  WHERE id = v_participant_id
    AND reward_claimed_at IS NULL;

  IF NOT FOUND THEN
    -- Already claimed (or lost a concurrent race): no fresh credit. Report the
    -- amount that was actually banked, not the one this caller just computed.
    RETURN json_build_object('claimed', false, 'fruit_reward', COALESCE(v_existing, 0));
  END IF;

  RETURN json_build_object('claimed', true, 'fruit_reward', COALESCE(v_reward, 0));
END;
$$;
