import React, { useEffect, useState } from 'react';
import {
  View,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button/Button';
import { colors } from '../../src/config/theme';
import { useAppStore } from '../../src/store';
import { useReferralLink } from '../../src/hooks/useReferralLink';
import { REFERRAL_TIERS } from '../../src/store/slices/referralSlice';
import { showToast } from '../../src/components/ui/Toast';
import { useTranslation } from 'react-i18next';

export default function ReferralDetailsModal() {
  const { t } = useTranslation();
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
        showToast(t('referral.applesEarned', { count: tier.reward }), 'success');
      } else {
        showToast(t('referral.premiumUnlocked'), 'success');
      }
    } catch (error: any) {
      const msg = error.message;
      if (msg === 'ALREADY_CLAIMED') {
        Alert.alert(t('referral.alreadyClaimedTitle'), t('referral.alreadyClaimedBody'));
      } else if (msg === 'NOT_ENOUGH_REFERRALS') {
        Alert.alert(t('referral.notEnoughTitle'), t('referral.notEnoughBody'));
      } else {
        Alert.alert(t('common.error'), t('referral.failedClaim'));
      }
    } finally {
      setClaimingTier(null);
    }
  };

  const handleCopy = async () => {
    await copyToClipboard();
    showToast(t('referral.linkCopied'), 'success');
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] flex-row items-center px-5">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <Ionicons
            name="chevron-back"
            size={24}
            color={isDark ? colors.dark.textSecondary : colors.light.screenTextPrimary}
          />
        </Pressable>
        <Typography variant="headline-20" color="primary">
          {t('referral.title')}
        </Typography>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* Progress summary */}
        <View className="mt-2 rounded-2xl bg-light-border/30 p-5 dark:bg-dark-card">
          <Typography variant="headline-24" color="primary" className="text-center">
            {referralCount}
          </Typography>
          <Typography variant="body-14" color="secondary" className="mt-1 text-center">
            {t('referral.referredLabel', { count: referralCount })}
          </Typography>
        </View>

        {/* Reward tiers */}
        <Typography
          variant="subtitle-14-medium"
          className="mb-3 mt-6 text-primary-light dark:text-primary">
          {t('referral.rewardTiers')}
        </Typography>

        <View className="overflow-hidden rounded-2xl bg-light-border/30 dark:bg-dark-card">
          {REFERRAL_TIERS.map((tier, index) => {
            const tierIndex = index + 1;
            const isClaimed = claimedTier >= tierIndex;
            const isEligible = referralCount >= tier.referrals && !isClaimed;
            const isLast = index === REFERRAL_TIERS.length - 1;
            const isClaiming = claimingTier === tierIndex;

            const rewardLabel =
              tier.type === 'apples'
                ? t('referral.apples', { count: tier.reward })
                : t('referral.lifetimePremium');

            return (
              <View
                key={tierIndex}
                className={`flex-row items-center px-4 py-4 ${
                  !isLast ? 'border-b border-light-border dark:border-dark-border' : ''
                }`}>
                {/* Progress indicator */}
                <View
                  className={`mr-3 h-8 w-8 items-center justify-center rounded-full ${
                    isClaimed
                      ? 'bg-green-500/20'
                      : referralCount >= tier.referrals
                        ? 'bg-primary-soft-20'
                        : 'bg-light-border dark:bg-dark-border'
                  }`}>
                  {isClaimed ? (
                    <Ionicons name="checkmark" size={18} color={colors.success} />
                  ) : (
                    <Typography
                      variant="body-12"
                      color={referralCount >= tier.referrals ? 'primary' : 'secondary'}
                      className="font-poppins-medium">
                      {tier.referrals}
                    </Typography>
                  )}
                </View>

                {/* Tier info */}
                <View className="flex-1">
                  <Typography variant="subtitle-14-medium" color="primary">
                    {t('referral.referralsLabel', { count: tier.referrals })}
                  </Typography>
                  <Typography variant="body-12" color="secondary">
                    {rewardLabel}
                  </Typography>
                </View>

                {/* Action */}
                {isClaimed ? (
                  <Typography
                    variant="body-12"
                    style={{ color: colors.success }}
                    className="font-poppins-medium">
                    {t('referral.claimed')}
                  </Typography>
                ) : isEligible ? (
                  <Pressable
                    onPress={() => handleClaim(tierIndex)}
                    disabled={isClaiming}
                    className="rounded-lg bg-primary px-3 py-1.5 active:opacity-80">
                    {isClaiming ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Typography variant="body-12" className="font-poppins-medium text-white">
                        {t('referral.claim')}
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
        <Typography
          variant="subtitle-14-medium"
          className="mb-3 mt-6 text-primary-light dark:text-primary">
          {t('referral.shareLink')}
        </Typography>

        <View className="rounded-2xl bg-light-border/30 p-4 dark:bg-dark-card">
          {referralLink ? (
            <Pressable onPress={handleCopy} className="active:opacity-70">
              <Typography variant="body-12" color="secondary" className="text-center" selectable>
                {referralLink}
              </Typography>
            </Pressable>
          ) : (
            <Typography variant="body-12" color="secondary" className="text-center">
              {t('referral.tapShare')}
            </Typography>
          )}
        </View>

        {/* Action buttons */}
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Button variant="secondary" size="medium" onPress={handleCopy} disabled={isGenerating}>
              {t('referral.copyLink')}
            </Button>
          </View>
          <View className="flex-1">
            <Button variant="primary" size="medium" onPress={shareLink} disabled={isGenerating}>
              {t('common.share')}
            </Button>
          </View>
        </View>

        {/* Bottom spacing */}
        <View className="h-10" />
      </ScrollView>
    </SafeAreaView>
  );
}
