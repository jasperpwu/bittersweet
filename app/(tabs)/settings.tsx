import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  Pressable,
  useColorScheme,
  ActivityIndicator,
  Linking,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/config/theme';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { router } from 'expo-router';
import { AccountActions } from '../../src/components/auth/AccountActions';
import { GoogleSignInButton, SignInSheet } from '../../src/components/auth/SignInSheet';
import { useUpgradeFlow } from '../../src/hooks/useTagUpgradeFlow';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useAppStore } from '../../src/store';
import { ProfileAvatar } from '../../src/components/grove/ProfileAvatar';
import { SwipeableTabWrapper } from '../../src/components/ui/SwipeableTabWrapper';
import { useReferralLink } from '../../src/hooks/useReferralLink';
import { useTranslation } from 'react-i18next';
import { directionalIcon } from '../../src/utils/directionalIcon';

interface CategoryCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Shows a small "PREMIUM" pill next to the title to mark a paid feature. */
  premiumBadge?: boolean;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  premiumBadge = false,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center rounded-2xl bg-light-border/30 px-4 py-4 active:opacity-80 dark:bg-dark-card">
      <View
        className="mr-3 h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconColor + '20' }}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center">
          <Typography variant="subtitle-14-medium" color="primary">
            {title}
          </Typography>
          {premiumBadge && (
            <View className="ml-2 flex-row items-center rounded-full bg-primary-soft px-2 py-0.5">
              <Ionicons name="diamond" size={9} color={colors.primary} />
              <Typography variant="tiny-10" className="ml-1 font-poppins-semibold text-primary">
                PREMIUM
              </Typography>
            </View>
          )}
        </View>
        <Typography variant="body-12" color="secondary" className="mt-0.5">
          {subtitle}
        </Typography>
      </View>
      <Ionicons
        name={directionalIcon('chevron-forward')}
        size={16}
        color={isDark ? colors.dark.border : colors.light.screenBorder}
      />
    </Pressable>
  );
};

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { triggerHaptic, deviceInfo } = useDeviceIntegration();
  const { isPremium } = useSubscriptionGate();
  const { triggerUpgrade, upgradeModals } = useUpgradeFlow('health');

  const {
    user,
    isAuthenticated,
    isLoading: authLoading,
    error: authError,
  } = useAppStore((state) => state.auth);
  const signInWithApple = useAppStore((state) => state.auth.signInWithApple);
  const signInWithGoogle = useAppStore((state) => state.auth.signInWithGoogle);
  const profile = useAppStore((s) => s.grove.profile);
  const profileLoaded = useAppStore((s) => s.grove.profileLoaded);
  const referralCount = useAppStore((s) => s.referral.referralCount);
  const fetchReferralStatus = useAppStore((s) => s.referral.fetchReferralStatus);
  const { shareLink, isGenerating } = useReferralLink();
  const [emailSignInOpen, setEmailSignInOpen] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchReferralStatus();
    }
  }, [isAuthenticated]);

  const userSinceLabel = user?.createdAt
    ? t('settings.tab.userSince', {
        date: new Date(user.createdAt).toLocaleDateString(i18n.language, {
          month: 'long',
          year: 'numeric',
        }),
      })
    : null;

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      <SwipeableTabWrapper currentTab="settings">
        {/* Header */}
        <View className="h-[56px] flex-row items-center px-5">
          <Typography variant="headline-24" color="primary">
            {t('settings.tab.header')}
          </Typography>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Motivational line — folded under the Settings header as a quiet
            subtitle, not a competing second title. */}
          <View className="px-5 pb-2 pt-1">
            <Typography variant="body-14" color="secondary">
              {t('settings.tab.quoteTitle')} {t('settings.tab.quoteSubtitle')}
            </Typography>
          </View>

          {/* Sign In Section (unauthenticated) */}
          {!isAuthenticated && (
            <View className="mt-4 px-5">
              <View className="rounded-2xl bg-light-border/30 px-4 py-4 dark:bg-dark-card">
                <Typography variant="body-14" color="secondary" className="mb-4">
                  {t('settings.tab.signInPrompt')}
                </Typography>
                {authLoading ? (
                  <View className="items-center py-3">
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                      cornerRadius={12}
                      style={{ width: '100%', height: 48 }}
                      onPress={signInWithApple}
                    />
                    <GoogleSignInButton onPress={signInWithGoogle} />
                    <Button
                      variant="outline"
                      size="medium"
                      fullWidth
                      onPress={() => setEmailSignInOpen(true)}>
                      <View className="flex-row items-center">
                        <Ionicons name="mail-outline" size={18} color={colors.primary} />
                        <Typography variant="subtitle-14-semibold" color="primary" className="ml-2">
                          {t('auth.continueWithEmail')}
                        </Typography>
                      </View>
                    </Button>
                  </View>
                )}
                {authError && (
                  <Typography variant="body-12" color="error" className="mt-2">
                    {authError}
                  </Typography>
                )}
                <View className="mt-3 flex-row items-center justify-center">
                  <Pressable onPress={() => Linking.openURL('https://bittersweet-app.github.io/terms.html')}>
                    <Typography variant="body-12" color="secondary" className="underline">
                      {t('settings.tab.terms')}
                    </Typography>
                  </Pressable>
                  <Typography variant="body-12" color="secondary" className="mx-2">
                    ·
                  </Typography>
                  <Pressable onPress={() => Linking.openURL('https://bittersweet-app.github.io/privacy.html')}>
                    <Typography variant="body-12" color="secondary" className="underline">
                      {t('settings.tab.privacy')}
                    </Typography>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {/* Profile Hero Section */}
          {isAuthenticated && user && (
            <View className="mt-4 px-5">
              <View className="rounded-2xl bg-light-border/30 px-4 py-4 dark:bg-dark-card">
                <View className="flex-row items-center">
                  {profile ? (
                    <View className="mr-3.5">
                      <ProfileAvatar
                        avatarUrl={profile.avatar_url}
                        displayName={profile.display_name}
                        avatarColor={profile.avatar_color}
                        size={56}
                      />
                    </View>
                  ) : (
                    <View className="mr-3.5 h-14 w-14 items-center justify-center rounded-full bg-primary-soft-20">
                      <Ionicons name="person" size={28} color={colors.primary} />
                    </View>
                  )}
                  <View className="flex-1">
                    <Typography variant="subtitle-16" color="primary" className="font-semibold">
                      {profile?.display_name || user.fullName || t('settings.tab.appleUser')}
                    </Typography>
                    {profile?.handle && (
                      <Typography variant="body-12" color="secondary">
                        @{profile.handle}
                      </Typography>
                    )}
                    {userSinceLabel && (
                      <Typography variant="body-12" color="secondary" className="mt-0.5">
                        {userSinceLabel}
                      </Typography>
                    )}
                  </View>
                </View>

                {/* Edit Profile button */}
                {profile && (
                  <Button
                    variant="secondary"
                    size="small"
                    fullWidth
                    textVariant="subtitle-14-medium"
                    className="mt-3 py-2"
                    onPress={() => router.push('/(modals)/grove-edit')}>
                    {t('settings.tab.editProfile')}
                  </Button>
                )}
                {!profile && profileLoaded && (
                  <Button
                    variant="soft"
                    size="small"
                    fullWidth
                    textVariant="subtitle-14-medium"
                    className="mt-3 bg-primary-soft-10 py-2.5"
                    onPress={() => router.push('/(modals)/grove-setup')}>
                    {t('settings.tab.setupGrove')}
                  </Button>
                )}
              </View>
            </View>
          )}

          {/* Category Cards */}
          <View className="mt-6 px-5" style={{ gap: 12 }}>
            <CategoryCard
              icon="options-outline"
              iconColor="#6592E9"
              title={t('settings.tab.preferences')}
              subtitle={t('settings.tab.preferencesSub')}
              onPress={() => {
                triggerHaptic('light');
                router.push('/settings/preferences' as any);
              }}
            />

            <CategoryCard
              icon="diamond-outline"
              iconColor="#9C27B0"
              title={t('settings.tab.subscription')}
              subtitle={t('settings.tab.subscriptionSub')}
              onPress={() => {
                triggerHaptic('light');
                router.push('/settings/subscription' as any);
              }}
            />

            <CategoryCard
              icon="people-outline"
              iconColor="#51BC6F"
              title={t('settings.tab.grove')}
              subtitle={t('settings.tab.groveSub')}
              onPress={() => {
                triggerHaptic('light');
                router.push('/settings/grove-settings' as any);
              }}
            />

            <CategoryCard
              icon="heart-outline"
              iconColor="#FF6B6B"
              title={t('settings.tab.health')}
              subtitle={t('settings.tab.healthSub')}
              premiumBadge
              onPress={() => {
                triggerHaptic('light');
                // Premium gate: non-subscribers see the upgrade prompt instead of the screen.
                if (!isPremium) {
                  triggerUpgrade();
                  return;
                }
                router.push('/settings/health' as any);
              }}
            />

            <CategoryCard
              icon="help-circle-outline"
              iconColor="#F5A623"
              title={t('settings.tab.support')}
              subtitle={t('settings.tab.supportSub')}
              onPress={() => {
                triggerHaptic('light');
                router.push('/settings/support' as any);
              }}
            />
          </View>

          {/* Referral Card */}
          {isAuthenticated && (
            <View className="mt-6 px-5">
              <Pressable
                onPress={() => router.push('/(modals)/referral-details' as any)}
                className="rounded-2xl bg-light-border/30 p-4 active:opacity-80 dark:bg-dark-card">
                <View className="mb-3 flex-row items-center">
                  <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-primary-soft">
                    <Typography variant="body-14" style={{ fontSize: 20 }}>
                      🍎
                    </Typography>
                  </View>
                  <View className="flex-1">
                    <Typography
                      variant="subtitle-16"
                      color="primary"
                      className="font-poppins-semibold">
                      {t('settings.tab.referralTitle')}
                    </Typography>
                  </View>
                </View>

                <Typography variant="body-14" color="secondary" className="mb-4">
                  {referralCount > 0
                    ? t('settings.tab.referralCount', { count: referralCount })
                    : t('settings.tab.referralEmpty')}
                </Typography>

                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <Button
                    variant="primary"
                    size="small"
                    haptic
                    disabled={isGenerating}
                    className="flex-row px-5 py-2.5"
                    onPress={(e) => {
                      e.stopPropagation();
                      shareLink();
                    }}>
                    <Ionicons name="share-outline" size={16} color={colors.white} />
                    <Typography variant="subtitle-14-medium" className="ml-1.5 text-white">
                      {t('settings.tab.shareLink')}
                    </Typography>
                  </Button>

                  <View className="flex-row items-center">
                    <Typography variant="body-12" color="secondary">
                      {t('settings.tab.seeRewards')}
                    </Typography>
                    <Ionicons
                      name={directionalIcon('chevron-forward')}
                      size={14}
                      color={isDark ? colors.dark.border : colors.light.screenBorder}
                      style={{ marginLeft: 2 }}
                    />
                  </View>
                </View>
              </Pressable>
            </View>
          )}

          {/* Account Actions */}
          <AccountActions />

          {/* Developer (dev only) */}
          {__DEV__ && (
            <View className="mt-6 px-5">
              <Typography
                variant="subtitle-14-medium"
                className="mb-3 text-primary-light dark:text-primary">
                Developer
              </Typography>

              <Button
                variant="ghost"
                fullWidth
                className="mb-4 items-start rounded-2xl bg-light-border/30 px-4 py-3 dark:bg-dark-card"
                onPress={() => router.push('/(modals)/dev-tools')}>
                <Typography variant="subtitle-14-semibold" color="primary">
                  Open Dev Tools
                </Typography>
              </Button>

              <View className="rounded-2xl bg-light-border/30 p-4 dark:bg-dark-card">
                <Typography variant="body-12" color="secondary">
                  Device: {deviceInfo.brand} {deviceInfo.modelName}
                </Typography>
                <Typography variant="body-12" color="secondary" className="mt-1">
                  OS: {deviceInfo.osName} {deviceInfo.osVersion}
                </Typography>
              </View>
            </View>
          )}

          {/* Footer */}
          <View className="mb-6 mt-10 items-center">
            <Typography variant="tiny-10" color="secondary">
              Bittersweet v1.0.0
            </Typography>
            <Typography variant="tiny-10" color="secondary" className="mt-1">
              Per aspera ad astra
            </Typography>
          </View>

          {/* Bottom spacing for tab bar */}
          <View className="h-20" />
        </ScrollView>

        {/* Apple Health premium gate — prompt → sign-in → subscription sheet */}
        {upgradeModals}

        {/* Opens straight on the email form — Apple/Google are already above. */}
        <SignInSheet
          visible={emailSignInOpen}
          onClose={() => setEmailSignInOpen(false)}
          initialMode="signIn"
        />
      </SwipeableTabWrapper>
    </SafeAreaView>
  );
}
