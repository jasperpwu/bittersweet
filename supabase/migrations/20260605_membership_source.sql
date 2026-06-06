-- ============================================================
-- Membership Source & App Store Status
-- Adds server-side subscription management fields
-- ============================================================

-- 1. Add membership_source to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_source TEXT NOT NULL DEFAULT 'none'
    CHECK (membership_source IN ('none', 'app_store', 'referral', 'manual'));

-- 2. Add app_store_status to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS app_store_status TEXT
    CHECK (app_store_status IS NULL OR app_store_status IN (
      'active', 'expired', 'billing_retry', 'grace_period', 'revoked', 'refunded'
    ));

-- 3. Backfill existing data
-- Users with original_transaction_id are App Store subscribers
UPDATE public.profiles
SET membership_source = 'app_store'
WHERE original_transaction_id IS NOT NULL
  AND membership_source = 'none';

-- Users who claimed tier 5 referral reward have referral-granted premium
UPDATE public.profiles p
SET membership_source = 'referral'
FROM public.referral_tracking rt
WHERE rt.user_id = p.id
  AND rt.claimed_tier >= 5
  AND p.subscription_tier = 'premium'
  AND p.membership_source = 'none';

-- 4. Enhance subscription_receipts with additional tracking fields
ALTER TABLE public.subscription_receipts
  ADD COLUMN IF NOT EXISTS environment TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS renewal_info JSONB,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- 5. Update claim_referral_reward to set membership_source on lifetime grant
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
        membership_source = 'referral',
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
