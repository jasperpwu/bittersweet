import React, { useState, useCallback } from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Alert, Image, ActivityIndicator, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { PrivacyToggleList } from '../../src/components/grove/PrivacyToggleList';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { useTranslation } from 'react-i18next';

export default function GroveSettingsScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? '#CACACA' : '#8B7355';
  const { triggerHaptic } = useDeviceIntegration();

  const profile = useAppStore((s) => s.grove.profile);
  const profileLoaded = useAppStore((s) => s.grove.profileLoaded);
  const isActive = useAppStore((s) => s.grove.isActive);
  const isGroveLoading = useAppStore((s) => s.grove.isLoading);
  const toggleGroveActive = useAppStore((s) => s.grove.toggleGroveActive);
  const friendCount = useAppStore((s) => s.grove.friends.length);
  const clearGroveCache = useAppStore((s) => s.grove.clearGroveCache);
  const privacySettings = useAppStore((s) => s.grove.privacySettings);
  const updatePrivacySettings = useAppStore((s) => s.grove.updatePrivacySettings);
  const tags = useAppStore((s) => s.focus.tags);

  // Privacy state
  const [sharedTagIds, setSharedTagIds] = useState<string[]>(
    privacySettings?.shared_tag_ids ?? []
  );
  const [shareNotes, setShareNotes] = useState(privacySettings?.share_notes ?? false);
  const [showLiveStatus, setShowLiveStatus] = useState(
    privacySettings?.show_live_status ?? false
  );
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false);

  const activeTags = tags.allIds
    .map((id) => tags.byId[id])
    .filter((tag) => tag && !tag.deletedAt)
    .map((tag) => ({ id: tag.id, name: tag.name, icon: tag.icon || '🎯' }));

  const handleToggleTag = (tagId: string) => {
    setSharedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const privacyChanged =
    privacySettings &&
    (shareNotes !== privacySettings.share_notes ||
      showLiveStatus !== privacySettings.show_live_status ||
      JSON.stringify([...sharedTagIds].sort()) !==
        JSON.stringify([...privacySettings.shared_tag_ids].sort()));

  const handleSavePrivacy = useCallback(async () => {
    if (!privacyChanged) return;
    setIsSavingPrivacy(true);
    try {
      await updatePrivacySettings({
        shared_tag_ids: sharedTagIds,
        share_notes: shareNotes,
        show_live_status: showLiveStatus,
      });
      triggerHaptic('success');
    } catch {
      Alert.alert(t('common.error'), t('groveSettings.failedPrivacy'));
    } finally {
      setIsSavingPrivacy(false);
    }
  }, [sharedTagIds, shareNotes, showLiveStatus, privacyChanged]);

  const handleToggleActive = async () => {
    try {
      await toggleGroveActive(!isActive);
    } catch {
      Alert.alert(t('common.error'), t('groveSettings.failedStatus'));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <Ionicons name="chevron-back" size={24} color={isDark ? '#FFFFFF' : '#5D4E37'} />
        </Pressable>
        <Typography variant="headline-20" color="primary">
          {t('settings.tab.grove')}
        </Typography>
      </View>

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
                  isLast
                />
              </SettingsSection>
            )}

            {/* Profile Status */}
            <SettingsSection title={t('groveSettings.visibility')}>
              <Pressable
                onPress={handleToggleActive}
                disabled={isGroveLoading}
                className="flex-row items-center justify-between py-3 active:opacity-70"
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-8 items-center mr-3">
                    <Ionicons
                      name={isActive ? 'eye-outline' : 'eye-off-outline'}
                      size={20}
                      color={iconColor}
                    />
                  </View>
                  <View className="flex-1">
                    <Typography variant="subtitle-14-medium" color="primary">
                      {isActive ? t('groveSettings.profileActive') : t('groveSettings.profilePaused')}
                    </Typography>
                    <Typography variant="body-12" color="secondary">
                      {isActive
                        ? t('groveSettings.activeDesc')
                        : t('groveSettings.pausedDesc')}
                    </Typography>
                  </View>
                </View>
                {isGroveLoading ? (
                  <ActivityIndicator size="small" color="#6592E9" />
                ) : (
                  <View
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      isActive ? 'bg-[#51BC6F]' : 'bg-light-border dark:bg-dark-border'
                    }`}
                  >
                    <Ionicons
                      name={isActive ? 'checkmark' : 'pause'}
                      size={16}
                      color="#FFFFFF"
                    />
                  </View>
                )}
              </Pressable>
            </SettingsSection>
          </>
        )}

        {/* Privacy & Sharing */}
        {profile && isActive && (
          <View className="px-5 mt-6">
            <View className="flex-row items-center justify-between mb-3">
              <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary">
                {t('groveSettings.privacySharing')}
              </Typography>
              {privacyChanged && (
                <Pressable
                  onPress={handleSavePrivacy}
                  disabled={isSavingPrivacy}
                  className="active:opacity-70"
                >
                  {isSavingPrivacy ? (
                    <ActivityIndicator size="small" color="#6592E9" />
                  ) : (
                    <Typography variant="subtitle-14-medium" className="text-primary">
                      {t('common.save')}
                    </Typography>
                  )}
                </Pressable>
              )}
            </View>
            <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4 py-3">
              <PrivacyToggleList
                tags={activeTags}
                sharedTagIds={sharedTagIds}
                shareNotes={shareNotes}
                showLiveStatus={showLiveStatus}
                onToggleTag={handleToggleTag}
                onToggleShareNotes={setShareNotes}
                onToggleShowLiveStatus={setShowLiveStatus}
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
              Alert.alert(
                t('groveSettings.clearCache'),
                t('groveSettings.clearCacheBody'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('groveSettings.clear'),
                    style: 'destructive',
                    onPress: () => {
                      clearGroveCache();
                      triggerHaptic('success');
                    },
                  },
                ]
              );
            }}
            isLast
          />
        </SettingsSection>

        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}
