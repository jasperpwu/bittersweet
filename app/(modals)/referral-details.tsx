import React, { useEffect, useState } from 'react';
import { View, SafeAreaView, ScrollView, Pressable, Alert, ActivityIndicator, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button/Button';
import { useAppStore } from '../../src/store';
import { useReferralLink } from '../../src/hooks/useReferralLink';
import { REFERRAL_TIERS } from '../../src/store/slices/referralSlice';
import { showToast } from '../../src/components/ui/Toast';

export default function ReferralDetailsModal() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const referralCount = useAppStore((s) => s.referral.referralCount);
  const claimedTier = useAppStore((s) => s.referral.claimedTier);
  const claimReward = useAppStore((s) => s.referral.claimReward);
  const fetchReferralStatus = useAppStore((s) => s.referral.fetchReferralStatus);
  const isLoading = useAppStore((s) => s.referral.isLoading);
  const { shareLink, isGenerating, referralLink, copyToClipboard } = useReferralLink();
  const [claimingTier, setClaimingTier] = useState<number | null>(null);

  useEffect(() => {
    fetchReferralStatus();
  }, []);

  const handleClaim = async (tierIndex: number) => {
    setClaimingTier(tierIndex);
    try {
      await claimReward(tierIndex);
      const tier = REFERRAL_TIERS[tierIndex - 1];
      if (tier.type === 'apples') {
        showToast(`+${tier.reward} apples earned!`, 'success');
      } else {
        showToast('Lifetime Premium unlocked!', 'success');
      }
    } catch (error: any) {
      const msg = error.message;
      if (msg === 'ALREADY_CLAIMED') {
        Alert.alert('Already Claimed', 'You have already claimed this reward.');
      } else if (msg === 'NOT_ENOUGH_REFERRALS') {
        Alert.alert('Not Enough Referrals', 'You need more referrals to claim this reward.');
      } else {
        Alert.alert('Error', 'Failed to claim reward. Please try again.');
      }
    } finally {
      setClaimingTier(null);
    }
  };

  const handleCopy = async () => {
    await copyToClipboard();
    showToast('Link copied!', 'success');
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <Ionicons name="chevron-back" size={24} color={isDark ? '#CACACA' : '#333'} />
        </Pressable>
        <Typography variant="headline-20" color="primary">
          Refer Friends
        </Typography>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Progress summary */}
        <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-5 mt-2">
          <Typography variant="headline-24" color="primary" className="text-center">
            {referralCount}
          </Typography>
          <Typography variant="body-14" color="secondary" className="text-center mt-1">
            {referralCount === 1 ? 'friend referred' : 'friends referred'}
          </Typography>
        </View>

        {/* Reward tiers */}
        <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mt-6 mb-3">
          Reward Tiers
        </Typography>

        <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl overflow-hidden">
          {REFERRAL_TIERS.map((tier, index) => {
            const tierIndex = index + 1;
            const isClaimed = claimedTier >= tierIndex;
            const isEligible = referralCount >= tier.referrals && !isClaimed;
            const isLast = index === REFERRAL_TIERS.length - 1;
            const isClaiming = claimingTier === tierIndex;

            const rewardLabel = tier.type === 'apples'
              ? `${tier.reward} apples`
              : 'Lifetime Premium';

            return (
              <View
                key={tierIndex}
                className={`flex-row items-center px-4 py-4 ${
                  !isLast ? 'border-b border-light-border dark:border-dark-border' : ''
                }`}
              >
                {/* Progress indicator */}
                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                  isClaimed
                    ? 'bg-green-500/20'
                    : referralCount >= tier.referrals
                    ? 'bg-primary/20'
                    : 'bg-light-border dark:bg-dark-border'
                }`}>
                  {isClaimed ? (
                    <Ionicons name="checkmark" size={18} color="#22C55E" />
                  ) : (
                    <Typography
                      variant="body-12"
                      color={referralCount >= tier.referrals ? 'primary' : 'secondary'}
                      className="font-poppins-medium"
                    >
                      {tier.referrals}
                    </Typography>
                  )}
                </View>

                {/* Tier info */}
                <View className="flex-1">
                  <Typography variant="subtitle-14-medium" color="primary">
                    {tier.referrals} {tier.referrals === 1 ? 'Referral' : 'Referrals'}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    {rewardLabel}
                  </Typography>
                </View>

                {/* Action */}
                {isClaimed ? (
                  <Typography variant="body-12" style={{ color: '#22C55E' }} className="font-poppins-medium">
                    Claimed
                  </Typography>
                ) : isEligible ? (
                  <Pressable
                    onPress={() => handleClaim(tierIndex)}
                    disabled={isClaiming}
                    className="bg-primary rounded-lg px-3 py-1.5 active:opacity-80"
                  >
                    {isClaiming ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Typography variant="body-12" className="text-white font-poppins-medium">
                        Claim
                      </Typography>
                    )}
                  </Pressable>
                ) : (
                  <Typography variant="body-12" color="secondary">
                    {referralCount}/{tier.referrals}
                  </Typography>
                )}
              </View>
            );
          })}
        </View>

        {/* Share section */}
        <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mt-6 mb-3">
          Share Your Link
        </Typography>

        <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4">
          {referralLink ? (
            <Pressable onPress={handleCopy} className="active:opacity-70">
              <Typography variant="body-12" color="secondary" className="text-center" selectable>
                {referralLink}
              </Typography>
            </Pressable>
          ) : (
            <Typography variant="body-12" color="secondary" className="text-center">
              Tap share to generate your link
            </Typography>
          )}
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3 mt-4">
          <View className="flex-1">
            <Button
              variant="secondary"
              size="medium"
              onPress={handleCopy}
              disabled={isGenerating}
            >
              Copy Link
            </Button>
          </View>
          <View className="flex-1">
            <Button
              variant="primary"
              size="medium"
              onPress={shareLink}
              disabled={isGenerating}
            >
              Share
            </Button>
          </View>
        </View>

        {/* Bottom spacing */}
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
