import React, { useEffect } from 'react';
import { View, Pressable, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../ui/Typography';
import { useReferralLink } from '../../hooks/useReferralLink';
import { useAppStore } from '../../store';

export const ReferralCard: React.FC = () => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { shareLink, isGenerating } = useReferralLink();
  const referralCount = useAppStore((s) => s.referral.referralCount);
  const fetchReferralStatus = useAppStore((s) => s.referral.fetchReferralStatus);
  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      fetchReferralStatus();
    }
  }, [isAuthenticated]);

  const subtitle = referralCount > 0
    ? `${referralCount} friend${referralCount === 1 ? '' : 's'} referred`
    : 'Share your link to get started';

  return (
    <View className="px-5 mt-6">
      <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
        Referrals
      </Typography>
      <Pressable
        onPress={() => router.push('/(modals)/referral-details' as any)}
        className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4 active:opacity-80"
      >
        <View className="flex-row items-center">
          <View className="flex-1">
            <Typography variant="subtitle-14-semibold" color="primary">
              Refer Friends, Earn Apples
            </Typography>
            <Typography variant="body-12" color="secondary" className="mt-1">
              {subtitle}
            </Typography>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              shareLink();
            }}
            disabled={isGenerating}
            className="bg-primary rounded-xl px-4 py-2.5 flex-row items-center active:opacity-80"
          >
            <Ionicons name="share-outline" size={16} color="#FFFFFF" />
            <Typography variant="body-12" className="ml-1.5 text-white font-poppins-medium">
              Share
            </Typography>
          </Pressable>
        </View>

        <View className="flex-row items-center mt-3">
          <Typography variant="body-12" color="secondary">
            Tap to see rewards
          </Typography>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={isDark ? '#575757' : '#D4C4A8'}
            style={{ marginLeft: 4 }}
          />
        </View>
      </Pressable>
    </View>
  );
};
