-- ============================================================
-- Referral System
-- Adds referral tracking on top of existing grove_invite_links
-- ============================================================

-- 1. Add referral columns to grove_invite_links
ALTER TABLE grove_invite_links
  ADD COLUMN IF NOT EXISTS referred_user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;

-- 2. Create referral_tracking table (per-user aggregate)
CREATE TABLE IF NOT EXISTS public.referral_tracking (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_count INTEGER NOT NULL DEFAULT 0,
  claimed_tier INTEGER NOT NULL DEFAULT 0,  -- highest tier index claimed (0 = none)
  referral_code TEXT,  -- user's personal referral code (cached from grove_invite_links)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referral tracking"
  ON public.referral_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own referral tracking"
  ON public.referral_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own referral tracking"
  ON public.referral_tracking FOR UPDATE
  USING (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER set_referral_tracking_updated_at
  BEFORE UPDATE ON public.referral_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. RPC: resolve_referral_code
-- Called by the referred user after sign-up.
-- Validates code, records the referral, increments referrer's count.
CREATE OR REPLACE FUNCTION public.resolve_referral_code(referral_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  invite_record grove_invite_links%ROWTYPE;
  referrer_id UUID;
  already_referred BOOLEAN;
BEGIN
  -- Find the invite link by code
  SELECT * INTO invite_record
  FROM grove_invite_links
  WHERE code = referral_code AND is_active = true;

  IF invite_record IS NULL THEN
    RETURN json_build_object('error', 'INVALID_CODE');
  END IF;

  referrer_id := invite_record.user_id;

  -- Can't refer yourself
  IF referrer_id = auth.uid() THEN
    RETURN json_build_object('error', 'SELF_REFERRAL');
  END IF;

  -- Check if this user was already referred by anyone
  SELECT EXISTS (
    SELECT 1 FROM grove_invite_links
    WHERE referred_user_id = auth.uid()
  ) INTO already_referred;

  IF already_referred THEN
    RETURN json_build_object('error', 'ALREADY_REFERRED');
  END IF;

  -- Record the referral on the invite link row
  -- Create a new row to track this specific referral
  INSERT INTO grove_invite_links (user_id, code, is_active, referred_user_id, referred_at)
  VALUES (referrer_id, referral_code || '_ref_' || substr(gen_random_uuid()::text, 1, 8), false, auth.uid(), now());

  -- Ensure referral_tracking row exists for referrer, then increment
  INSERT INTO referral_tracking (user_id, referral_count, referral_code)
  VALUES (referrer_id, 1, referral_code)
  ON CONFLICT (user_id) DO UPDATE
  SET referral_count = referral_tracking.referral_count + 1,
      updated_at = now();

  RETURN json_build_object(
    'status', 'success',
    'referrer_id', referrer_id
  );
END;
$$;

-- 4. RPC: claim_referral_reward
-- Validates the user has enough referrals and hasn't claimed this tier yet.
-- Awards apples or lifetime premium.
CREATE OR REPLACE FUNCTION public.claim_referral_reward(tier_index INTEGER)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  tracking referral_tracking%ROWTYPE;
  required_referrals INTEGER;
  reward_amount INTEGER;
  reward_type TEXT;
BEGIN
  -- Define tier requirements (1-indexed to match tier_index)
  CASE tier_index
    WHEN 1 THEN required_referrals := 1;  reward_amount := 10;  reward_type := 'apples';
    WHEN 2 THEN required_referrals := 3;  reward_amount := 50;  reward_type := 'apples';
    WHEN 3 THEN required_referrals := 5;  reward_amount := 100; reward_type := 'apples';
    WHEN 4 THEN required_referrals := 10; reward_amount := 300; reward_type := 'apples';
    WHEN 5 THEN required_referrals := 15; reward_amount := 0;   reward_type := 'lifetime';
    ELSE
      RETURN json_build_object('error', 'INVALID_TIER');
  END CASE;

  -- Get user's referral tracking
  SELECT * INTO tracking
  FROM referral_tracking
  WHERE user_id = auth.uid();

  IF tracking IS NULL THEN
    RETURN json_build_object('error', 'NO_REFERRALS');
  END IF;

  -- Check enough referrals
  IF tracking.referral_count < required_referrals THEN
    RETURN json_build_object('error', 'NOT_ENOUGH_REFERRALS');
  END IF;

  -- Check tier not already claimed
  IF tracking.claimed_tier >= tier_index THEN
    RETURN json_build_object('error', 'ALREADY_CLAIMED');
  END IF;

  -- Award the reward
  IF reward_type = 'apples' THEN
    UPDATE rewards
    SET balance = balance + reward_amount,
        total_earned = total_earned + reward_amount,
        updated_at = now()
    WHERE user_id = auth.uid();
  ELSIF reward_type = 'lifetime' THEN
    UPDATE profiles
    SET subscription_tier = 'premium',
        updated_at = now()
    WHERE id = auth.uid();
  END IF;

  -- Update claimed tier
  UPDATE referral_tracking
  SET claimed_tier = tier_index,
      updated_at = now()
  WHERE user_id = auth.uid();

  RETURN json_build_object(
    'status', 'success',
    'reward_type', reward_type,
    'reward_amount', reward_amount
  );
END;
$$;
