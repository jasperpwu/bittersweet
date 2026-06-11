import React, { useState, useEffect } from 'react';
import { View, ScrollView, SafeAreaView, Pressable, useColorScheme, Image, ActivityIndicator, Linking } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { useAppSettings } from '../../src/store/unified-store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { router } from 'expo-router';
import { AccountActions } from '../../src/components/auth/AccountSection';
import { UpgradeSheet } from '../../src/components/subscription/UpgradeSheet';
import { useAppStore } from '../../src/store';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { SwipeableTabWrapper } from '../../src/components/ui/SwipeableTabWrapper';
import { useReferralLink } from '../../src/hooks/useReferralLink';

interface CategoryCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ icon, iconColor, title, subtitle, onPress }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={onPress}
      className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4 py-4 flex-row items-center active:opacity-80"
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mr-3"
        style={{ backgroundColor: iconColor + '20' }}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View className="flex-1">
        <Typography variant="subtitle-14-medium" color="primary">
          {title}
        </Typography>
        <Typography variant="body-12" color="secondary" className="mt-0.5">
          {subtitle}
        </Typography>
      </View>
      <Ionicons name="chevron-forward" size={16} color={isDark ? '#575757' : '#D4C4A8'} />
    </Pressable>
  );
};

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { preferences } = useAppSettings();
  const { triggerHaptic, deviceInfo } = useDeviceIntegration();
  const [upgradeSheetVisible, setUpgradeSheetVisible] = useState(false);

  const { user, isAuthenticated, isLoading: authLoading, error: authError } = useAppStore((state) => state.auth);
  const signInWithApple = useAppStore((state) => state.auth.signInWithApple);
  const profile = useAppStore((s) => s.grove.profile);
  const profileLoaded = useAppStore((s) => s.grove.profileLoaded);
  const referralCount = useAppStore((s) => s.referral.referralCount);
  const fetchReferralStatus = useAppStore((s) => s.referral.fetchReferralStatus);
  const { shareLink, isGenerating } = useReferralLink();

  useEffect(() => {
    if (isAuthenticated) {
      fetchReferralStatus();
    }
  }, [isAuthenticated]);

  const userSinceLabel = user?.createdAt
    ? `User since ${new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    : null;

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
    <SwipeableTabWrapper currentTab="settings">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Typography variant="headline-24" color="primary">
          Settings
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Motivational Quote */}
        <View className="px-5 pt-2 pb-2">
          <Typography variant="headline-20" color="primary">
            Make today count.
          </Typography>
          <Typography variant="body-14" color="secondary" className="mt-1">
            Every focused minute is an investment in yourself.
          </Typography>
        </View>

        {/* Sign In Section (unauthenticated) */}
        {!isAuthenticated && (
          <View className="px-5 mt-4">
            <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4 py-4">
              <Typography variant="body-14" color="secondary" className="mb-4">
                Sign in to sync your data across devices and back up your progress.
              </Typography>
              {authLoading ? (
                <View className="items-center py-3">
                  <ActivityIndicator size="small" color="#8B7FFF" />
                </View>
              ) : (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={12}
                  style={{ width: '100%', height: 48 }}
                  onPress={signInWithApple}
                />
              )}
              {authError && (
                <Typography variant="body-12" className="text-[#FF6B6B] mt-2">
                  {authError}
                </Typography>
              )}
              <View className="flex-row justify-center items-center mt-3">
                <Pressable onPress={() => Linking.openURL('https://example.com/terms')}>
                  <Typography variant="body-12" color="secondary" className="underline">
                    Terms of Service
                  </Typography>
                </Pressable>
                <Typography variant="body-12" color="secondary" className="mx-2">
                  ·
                </Typography>
                <Pressable onPress={() => Linking.openURL('https://example.com/privacy')}>
                  <Typography variant="body-12" color="secondary" className="underline">
                    Privacy Policy
                  </Typography>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Profile Hero Section */}
        {isAuthenticated && user && (
          <View className="px-5 mt-4">
            <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4 py-4">
              <View className="flex-row items-center">
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={{ width: 56, height: 56, borderRadius: 28, marginRight: 14 }}
                  />
                ) : profile ? (
                  <View className="mr-3.5">
                    <DefaultAvatar
                      displayName={profile.display_name}
                      color={profile.avatar_color}
                      size={56}
                    />
                  </View>
                ) : (
                  <View className="w-14 h-14 rounded-full bg-primary/20 items-center justify-center mr-3.5">
                    <Ionicons name="person" size={28} color="#8B7FFF" />
                  </View>
                )}
                <View className="flex-1">
                  <Typography variant="subtitle-16" color="primary" className="font-semibold">
                    {profile?.display_name || user.fullName || 'Apple User'}
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
                <Pressable
                  onPress={() => router.push('/(modals)/grove-edit')}
                  className="mt-3 border border-light-border dark:border-dark-border rounded-xl py-2 items-center active:opacity-70"
                >
                  <Typography variant="subtitle-14-medium" color="primary">
                    Edit Profile
                  </Typography>
                </Pressable>
              )}
              {!profile && profileLoaded && (
                <Pressable
                  onPress={() => router.push('/(modals)/grove-setup')}
                  className="mt-3 bg-primary/10 rounded-xl py-2.5 items-center active:opacity-70"
                >
                  <Typography variant="subtitle-14-medium" className="text-primary">
                    Set Up Grove Profile
                  </Typography>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Category Cards */}
        <View className="px-5 mt-6" style={{ gap: 12 }}>
          <CategoryCard
            icon="options-outline"
            iconColor="#6592E9"
            title="Preferences"
            subtitle="Notifications, goals, focus settings"
            onPress={() => {
              triggerHaptic('light');
              router.push('/settings/preferences' as any);
            }}
          />

          <CategoryCard
            icon="diamond-outline"
            iconColor="#9C27B0"
            title="Subscription"
            subtitle="Manage your plan"
            onPress={() => {
              triggerHaptic('light');
              router.push('/settings/subscription' as any);
            }}
          />

          <CategoryCard
            icon="people-outline"
            iconColor="#51BC6F"
            title="Grove"
            subtitle="Friends, profile visibility, cache"
            onPress={() => {
              triggerHaptic('light');
              router.push('/settings/grove-settings' as any);
            }}
          />

          <CategoryCard
            icon="help-circle-outline"
            iconColor="#F5A623"
            title="Support & About"
            subtitle="Share, feedback, version"
            onPress={() => {
              triggerHaptic('light');
              router.push('/settings/support' as any);
            }}
          />
        </View>

        {/* Referral Card */}
        {isAuthenticated && (
          <View className="px-5 mt-6">
            <Pressable
              onPress={() => router.push('/(modals)/referral-details' as any)}
              className="overflow-hidden rounded-2xl active:opacity-90"
            >
              <View
                style={{
                  backgroundColor: isDark ? '#1E1A3A' : '#FFF8F0',
                  borderWidth: 1,
                  borderColor: isDark ? '#6592E940' : '#F5A62330',
                  borderRadius: 16,
                  padding: 20,
                }}
              >
                <View className="flex-row items-center mb-3">
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: isDark ? '#F5A62320' : '#F5A62315',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Typography variant="body-14" style={{ fontSize: 20 }}>🍎</Typography>
                  </View>
                  <View className="flex-1">
                    <Typography variant="subtitle-16" color="primary" className="font-poppins-semibold">
                      Refer Friends, Earn Apples
                    </Typography>
                  </View>
                </View>

                <Typography variant="body-14" color="secondary" className="mb-4">
                  {referralCount > 0
                    ? `You've referred ${referralCount} friend${referralCount === 1 ? '' : 's'}. Keep sharing to unlock more rewards!`
                    : 'Share your link with friends and earn apple rewards for each one who joins.'}
                </Typography>

                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      shareLink();
                    }}
                    disabled={isGenerating}
                    style={{
                      backgroundColor: '#F5A623',
                      borderRadius: 12,
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                    className="active:opacity-80"
                  >
                    <Ionicons name="share-outline" size={16} color="#FFFFFF" />
                    <Typography variant="subtitle-14-medium" className="ml-1.5 text-white">
                      Share Link
                    </Typography>
                  </Pressable>

                  <View className="flex-row items-center">
                    <Typography variant="body-12" color="secondary">
                      See rewards
                    </Typography>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={isDark ? '#575757' : '#D4C4A8'}
                      style={{ marginLeft: 2 }}
                    />
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        )}

        {/* Account Actions */}
        <AccountActions />

        {/* Developer (dev only) */}
        {__DEV__ && (
          <View className="px-5 mt-6">
            <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
              Developer
            </Typography>

            <Pressable
              onPress={() => router.push('/(modals)/dev-tools')}
              className="bg-light-border/30 dark:bg-[#242540] rounded-2xl py-3 px-4 mb-4 active:opacity-80"
            >
              <Typography variant="subtitle-14-semibold" color="primary">
                Open Dev Tools
              </Typography>
            </Pressable>

            <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4">
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
        <View className="items-center mt-10 mb-6">
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

      {/* Upgrade Sheet */}
      <UpgradeSheet
        isVisible={upgradeSheetVisible}
        onClose={() => setUpgradeSheetVisible(false)}
      />
    </SwipeableTabWrapper>
    </SafeAreaView>
  );
}
