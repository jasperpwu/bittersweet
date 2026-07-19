import React from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Linking, useColorScheme } from 'react-native';
import { colors } from '../../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { useAppStore } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { useUpgradeFlow } from '../../src/hooks/useTagUpgradeFlow';
import { useTranslation } from 'react-i18next';

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { triggerHaptic } = useDeviceIntegration();
  const { openPlans, upgradeModals } = useUpgradeFlow();
  const subscriptionTier = useAppStore((state) => state.subscription.tier);

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] flex-row items-center px-5">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <Ionicons
            name="chevron-back"
            size={24}
            color={isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary}
          />
        </Pressable>
        <Typography variant="headline-20" color="primary">
          {t('settings.tab.subscription')}
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <SettingsSection title={t('subscription.plan')}>
          {subscriptionTier === 'premium' ? (
            <>
              <SettingsItem
                title={t('subscription.premium')}
                subtitle={t('subscription.premiumSub')}
                icon="diamond-outline"
                valueLabel={t('subscription.active')}
              />
              <SettingsItem
                title={t('subscription.manage')}
                subtitle={t('subscription.manageSub')}
                icon="settings-outline"
                hasChevron
                onPress={() => {
                  triggerHaptic('light');
                  Linking.openURL('https://apps.apple.com/account/subscriptions');
                }}
                isLast
              />
            </>
          ) : (
            <SettingsItem
              title={t('subscription.freePlan')}
              subtitle={t('subscription.freeSub')}
              icon="diamond-outline"
              hasChevron
              valueLabel={t('subscription.upgrade')}
              onPress={() => {
                triggerHaptic('light');
                openPlans();
              }}
              isLast
            />
          )}
        </SettingsSection>

        <View className="h-20" />
      </ScrollView>

      {upgradeModals}
    </SafeAreaView>
  );
}
