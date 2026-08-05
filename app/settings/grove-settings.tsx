import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/config/theme';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { PrivacyToggleList } from '../../src/components/grove/PrivacyToggleList';
import { SignInSheet } from '../../src/components/auth/SignInSheet';
import { useAppStore } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { useTranslation } from 'react-i18next';
import { directionalIcon } from '../../src/utils/directionalIcon';

export default function GroveSettingsScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary;
  const { triggerHaptic } = useDeviceIntegration();

  const isAuthenticated = useAppStore((s) => s.auth.isAuthenticated);
  const profile = useAppStore((s) => s.grove.profile);
  const profileLoaded = useAppStore((s) => s.grove.profileLoaded);
  const isActive = useAppStore((s) => s.grove.isActive);
  const friendCount = useAppStore((s) => s.grove.friends.length);
  const clearGroveCache = useAppStore((s) => s.grove.clearGroveCache);
  const privacySettings = useAppStore((s) => s.grove.privacySettings);
  const updatePrivacySettings = useAppStore((s) => s.grove.updatePrivacySettings);
  const updateProfile = useAppStore((s) => s.grove.updateProfile);

  // Privacy state — tags and notes are always shared; profile type + live status are opt-in.
  // Local state mirrors the store for instant UI feedback; each change auto-saves (optimistic,
  // reverts on failure) just like every other setting — no explicit save button.
  const [profileType, setProfileType] = useState<'public' | 'private'>(
    profile?.profile_type ?? 'public'
  );
  const [showLiveStatus, setShowLiveStatus] = useState(privacySettings?.show_live_status ?? false);

  // Sign-in CTA for unauthenticated users; after signing in from here we wait
  // for the post-sign-in profile fetch (fetchProfile in _layout's auth listener
  // sets profileLoaded) and then open Grove setup if no profile exists yet.
  const [showSignIn, setShowSignIn] = useState(false);
  const [pendingSetup, setPendingSetup] = useState(false);

  useEffect(() => {
    if (!pendingSetup || !isAuthenticated || !profileLoaded) return;
    setPendingSetup(false);
    if (!profile) {
      router.push('/(modals)/grove-setup');
    }
  }, [pendingSetup, isAuthenticated, profileLoaded, profile]);

  const handleChangeProfileType = useCallback(
    async (value: 'public' | 'private') => {
      if (value === profileType) return;
      const prev = profileType;
      setProfileType(value);
      try {
        await updateProfile({ profile_type: value });
      } catch {
        setProfileType(prev);
        Alert.alert(t('common.error'), t('groveSettings.failedPrivacy'));
      }
    },
    [profileType, updateProfile, t]
  );

  const handleToggleLiveStatus = useCallback(
    async (value: boolean) => {
      const prev = showLiveStatus;
      setShowLiveStatus(value);
      try {
        await updatePrivacySettings({ show_live_status: value });
      } catch {
        setShowLiveStatus(prev);
        Alert.alert(t('common.error'), t('groveSettings.failedPrivacy'));
      }
    },
    [showLiveStatus, updatePrivacySettings, t]
  );

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] flex-row items-center px-5">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <Ionicons
            name={directionalIcon('chevron-back')}
            size={24}
            color={isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary}
          />
        </Pressable>
        <Typography variant="headline-20" color="primary">
          {t('settings.tab.grove')}
        </Typography>
      </View>

      {!isAuthenticated ? (
        <>
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="mt-10 items-center px-8">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Ionicons name="people-outline" size={32} color={colors.primary} />
              </View>
              <Typography variant="subtitle-16" color="primary" className="mb-2 text-center">
                {t('groveSettings.introTitle')}
              </Typography>
              <Typography variant="body-14" color="secondary" className="text-center">
                {t('groveSettings.introDesc')}
              </Typography>
            </View>

            <View className="mt-8 px-5">
              <View className="rounded-2xl bg-light-border/30 px-4 dark:bg-dark-card">
                {(
                  [
                    { icon: 'people-outline', key: 'introFeed', last: false },
                    { icon: 'trophy-outline', key: 'introChallenges', last: false },
                    { icon: 'heart-outline', key: 'introCircle', last: true },
                  ] as const
                ).map(({ icon, key, last }) => (
                  <View
                    key={key}
                    className={`flex-row items-center py-3 ${
                      last ? '' : 'border-b border-light-border dark:border-dark-border'
                    }`}>
                    <View className="mr-3 w-8 items-center">
                      <Ionicons name={icon} size={20} color={iconColor} />
                    </View>
                    <Typography variant="body-14" color="primary" className="flex-1">
                      {t(`groveSettings.${key}`)}
                    </Typography>
                  </View>
                ))}
              </View>

              <Button
                variant="primary"
                fullWidth
                haptic
                className="mt-6"
                onPress={() => setShowSignIn(true)}>
                {t('groveSettings.signInCta')}
              </Button>
            </View>
          </ScrollView>

          <SignInSheet
            visible={showSignIn}
            onClose={() => setShowSignIn(false)}
            onSignedIn={() => setPendingSetup(true)}
          />
        </>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {!profile ? (
            // Only surface the setup CTA once the profile fetch has resolved —
            // otherwise it flashes after sign-in (profile reset to null) before
            // the cloud fetch confirms the user actually has no profile.
            profileLoaded ? (
              <SettingsSection title={t('groveSettings.profile')}>
                <SettingsItem
                  title={t('groveSettings.setupTitle')}
                  subtitle={t('groveSettings.setupSub')}
                  icon="people-outline"
                  hasChevron
                  onPress={() => router.push('/(modals)/grove-setup')}
                  isLast
                />
              </SettingsSection>
            ) : null
          ) : (
            <>
              {/* Friends */}
              {isActive && (
                <SettingsSection title={t('groveSettings.social')}>
                  <SettingsItem
                    title={t('groveSettings.friendCount', { count: friendCount })}
                    subtitle={t('groveSettings.inviteSub')}
                    icon="people-outline"
                    hasChevron
                    onPress={() => router.push('/(modals)/add-friends')}
                  />
                  <SettingsItem
                    title={t('groveSettings.innerCircle')}
                    subtitle={t('groveSettings.innerCircleSub')}
                    icon="heart-outline"
                    hasChevron
                    onPress={() => router.push('/(modals)/inner-circle')}
                  />
                  <SettingsItem
                    title={t('moderation.blockedAccounts')}
                    subtitle={t('moderation.blockedAccountsSub')}
                    icon="ban-outline"
                    hasChevron
                    onPress={() => router.push('/(modals)/blocked-accounts')}
                    isLast
                  />
                </SettingsSection>
              )}

              {/* Profile Status (pause/resume) intentionally hidden: once a Grove
                  profile is set up we keep it active so the Grove tab stays visible.
                  Prioritizing Grove adoption over letting users silently opt out.
                  Restore this SettingsSection (and handleToggleActive) if we decide
                  to expose pausing again. */}
            </>
          )}

          {/* Privacy & Sharing */}
          {profile && isActive && (
            <View className="mt-6 px-5">
              <View className="mb-3">
                <Typography
                  variant="subtitle-14-medium"
                  className="text-primary-light dark:text-primary">
                  {t('groveSettings.privacySharing')}
                </Typography>
              </View>
              <View className="rounded-2xl bg-light-border/30 px-4 py-3 dark:bg-dark-card">
                <PrivacyToggleList
                  profileType={profileType}
                  showLiveStatus={showLiveStatus}
                  onChangeProfileType={handleChangeProfileType}
                  onToggleShowLiveStatus={handleToggleLiveStatus}
                />
              </View>
            </View>
          )}

          {/* Storage */}
          <SettingsSection title={t('groveSettings.storage')}>
            <SettingsItem
              title={t('groveSettings.clearCache')}
              subtitle={t('groveSettings.clearCacheSub')}
              icon="trash-outline"
              hasChevron
              onPress={() => {
                triggerHaptic('light');
                Alert.alert(t('groveSettings.clearCache'), t('groveSettings.clearCacheBody'), [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('groveSettings.clear'),
                    style: 'destructive',
                    onPress: () => {
                      clearGroveCache();
                      triggerHaptic('success');
                    },
                  },
                ]);
              }}
              isLast
            />
          </SettingsSection>

          <View className="h-20" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
