import React from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Linking, useColorScheme } from 'react-native';
import { colors } from '../../src/config/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { showManageSubscriptionsIOS } from 'expo-iap';
import { useAppStore } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { useUpgradeFlow } from '../../src/hooks/useTagUpgradeFlow';
import { useTranslation } from 'react-i18next';

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { triggerHaptic } = useDeviceIntegration();
  // 'settings': a voluntary upgrade tap, not a feature gate — see PaywallSource.
  const { openPlans, upgradeModals } = useUpgradeFlow('settings');
  const subscriptionTier = useAppStore((state) => state.subscription.tier);
  const checkSubscriptionStatus = useAppStore(
    (state) => state.subscription.checkSubscriptionStatus
  );

  /**
   * StoreKit's manage-subscriptions sheet, not the apps.apple.com account page.
   * The account page renders the *production* App Store account, so a sandbox
   * subscription (TestFlight) isn't listed there and its "cancel" just punts to
   * Settings, where the sandbox sub also doesn't appear. `showManageSubscriptions`
   * runs against whatever StoreKit environment the build is in, so it manages the
   * subscription the user actually bought.
   *
   * The sheet stays inside the app, so the foreground handler in _layout.tsx that
   * normally re-checks tier never fires — refresh explicitly on dismissal.
   */
  const handleManageSubscription = async () => {
    triggerHaptic('light');
    try {
      await showManageSubscriptionsIOS();
    } catch (error) {
      // Don't strand the user on a dead tap: fall back to the account page.
      console.error('[IAP] showManageSubscriptions failed:', error);
      Linking.openURL('https://apps.apple.com/account/subscriptions');
      return;
    }
    await checkSubscriptionStatus();
  };

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
                onPress={handleManageSubscription}
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
