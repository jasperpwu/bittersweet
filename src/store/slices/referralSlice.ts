import { supabase } from '../../config/supabase';
import { GroveFriendService } from '../../services/grove/GroveFriendService';
import { AnalyticsTracker } from '../../services/analytics';

export const REFERRAL_TIERS = [
  { referrals: 1, reward: 10, type: 'apples' as const },
  { referrals: 3, reward: 50, type: 'apples' as const },
  { referrals: 5, reward: 100, type: 'apples' as const },
  { referrals: 10, reward: 300, type: 'apples' as const },
  { referrals: 15, reward: 0, type: 'lifetime' as const },
];

export interface ReferralSlice {
  referralCode: string | null;
  referralCount: number;
  claimedTier: number; // highest claimed tier index (0 = none, 1-5 = tier)
  isLoading: boolean;

  generateReferralCode: () => Promise<string>;
  fetchReferralStatus: () => Promise<void>;
  claimReward: (tierIndex: number) => Promise<void>;
  applyReferralCode: (code: string) => Promise<void>;
  resetReferral: () => void;
}

const initialState = {
  referralCode: null as string | null,
  referralCount: 0,
  claimedTier: 0,
  isLoading: false,
};

export const createReferralSlice = (set: any, get: any): ReferralSlice => ({
  ...initialState,

  generateReferralCode: async () => {
    const existing = get().referral.referralCode;
    if (existing) return existing;

    try {
      // Reuse GroveFriendService's invite link generation
      const invite = await GroveFriendService.generateInviteLink();
      const code = invite.code;

      // Cache the code in referral_tracking too
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('referral_tracking')
          .upsert(
            { user_id: user.id, referral_code: code },
            { onConflict: 'user_id' }
          );
      }

      set((state: any) => ({
        referral: { ...state.referral, referralCode: code },
      }));

      // Analytics: top of the referral funnel. Guarded by the early-return above,
      // so this fires once per user when the code is first minted — repeat opens
      // of the referral screen reuse the cached code and don't re-fire.
      AnalyticsTracker.track('referral_code_created', undefined, {
        setOnce: { ever_generated_referral_code: true },
      });

      return code;
    } catch (error: any) {
      console.error('Failed to generate referral code:', error);
      throw error;
    }
  },

  fetchReferralStatus: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      set((state: any) => ({
        referral: { ...state.referral, isLoading: true },
      }));

      const { data, error } = await supabase
        .from('referral_tracking')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        set((state: any) => ({
          referral: {
            ...state.referral,
            referralCode: data.referral_code,
            referralCount: data.referral_count,
            claimedTier: data.claimed_tier,
            isLoading: false,
          },
        }));
      } else {
        set((state: any) => ({
          referral: { ...state.referral, isLoading: false },
        }));
      }
    } catch (error: any) {
      console.error('Failed to fetch referral status:', error);
      set((state: any) => ({
        referral: { ...state.referral, isLoading: false },
      }));
    }
  },

  claimReward: async (tierIndex: number) => {
    try {
      set((state: any) => ({
        referral: { ...state.referral, isLoading: true },
      }));

      const { data, error } = await supabase.rpc('claim_referral_reward', {
        tier_index: tierIndex,
      });

      if (error) throw error;

      const result = data as any;
      if (result.error) {
        throw new Error(result.error);
      }

      // Update local claimed tier
      set((state: any) => ({
        referral: {
          ...state.referral,
          claimedTier: tierIndex,
          isLoading: false,
        },
      }));

      // If apples were awarded, update local rewards balance
      if (result.reward_type === 'apples') {
        const tier = REFERRAL_TIERS[tierIndex - 1];
        if (tier) {
          set((state: any) => ({
            rewards: {
              ...state.rewards,
              balance: state.rewards.balance + tier.reward,
              totalEarned: state.rewards.totalEarned + tier.reward,
            },
          }));
        }
      }

      // If lifetime was awarded, update subscription tier
      if (result.reward_type === 'lifetime') {
        set((state: any) => ({
          subscription: {
            ...state.subscription,
            tier: 'premium',
          },
        }));
      }

      // Analytics: did the referral rewards ladder actually pull anyone up it?
      AnalyticsTracker.track('referral_reward_claimed', {
        tier_index: tierIndex,
        reward_type: result.reward_type,
      });
    } catch (error: any) {
      console.error('Failed to claim referral reward:', error);
      set((state: any) => ({
        referral: { ...state.referral, isLoading: false },
      }));
      throw error;
    }
  },

  applyReferralCode: async (code: string) => {
    try {
      const { data, error } = await supabase.rpc('resolve_referral_code', {
        referral_code: code,
      });

      if (error) throw error;

      const result = data as any;
      if (result.error) {
        // Silently ignore non-critical errors (already referred, self-referral)
        console.log('Referral code not applied:', result.error);
        return;
      }

      console.log('Referral code applied successfully');

      // Analytics: bottom of the referral funnel — a new user actually arrived
      // through someone's link. Compare unique users against referral_code_created
      // for the true viral coefficient.
      AnalyticsTracker.track('referral_redeemed', undefined, {
        setOnce: { acquired_via_referral: true },
      });
    } catch (error: any) {
      console.error('Failed to apply referral code:', error);
    }
  },

  resetReferral: () => {
    set((state: any) => ({
      referral: { ...state.referral, ...initialState },
    }));
  },
});
