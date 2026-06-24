import React, { useState } from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Alert, Linking, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { Toggle } from '../../src/components/ui/Toggle';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { TimePicker } from '../../src/components/ui/TimePicker';
import { useAppSettings } from '../../src/store/unified-store';
import { LanguageSelectorSheet } from '../../src/components/settings/LanguageSelector';
import { getLanguageByCode } from '../../src/i18n/languages';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { UpgradePrompt } from '../../src/components/subscription/UpgradePrompt';
import {
  getMotionPermissionStatus,
  ensureMotionPermission,
} from '../../src/services/motionInsights';
import { useTranslation } from 'react-i18next';

export default function PreferencesScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { preferences, updatePreferences } = useAppSettings();
  const { isPremium } = useSubscriptionGate();
  const {
    hasNotifications,
    triggerHaptic,
    requestNotificationPermissions,
  } = useDeviceIntegration();
  const [notificationSheetVisible, setNotificationSheetVisible] = useState(false);
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [showAdhdUpgrade, setShowAdhdUpgrade] = useState(false);

  const handleAdhdModeToggle = async (value: boolean) => {
    // Premium gate: non-subscribers see the upgrade prompt instead of toggling.
    if (!isPremium) {
      triggerHaptic('light');
      setShowAdhdUpgrade(true);
      return;
    }
    try {
      await updatePreferences({ adhdModeEnabled: value });
      triggerHaptic('light');
    } catch (error) {
      console.error('Failed to update Multi-Task mode setting:', error);
      triggerHaptic('error');
    }
  };

  const promptOpenMotionSettings = () => {
    Alert.alert(
      t('preferences.motionDeniedTitle'),
      t('preferences.motionDeniedBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('journal.openSettings'), onPress: () => Linking.openSettings() },
      ]
    );
  };

  // Detailed (raw-accelerometer) focus rating. Off by default — turning it on is
  // explicit consent to record device motion during sessions. Requires the iOS
  // Motion & Fitness permission; deep-links to Settings if it was denied.
  const handleDetailedRatingToggle = async (value: boolean) => {
    if (!value) {
      await updatePreferences({ rawAccelRatingEnabled: false });
      triggerHaptic('light');
      return;
    }
    const status = await getMotionPermissionStatus();
    if (status === 'granted') {
      await updatePreferences({ rawAccelRatingEnabled: true });
      triggerHaptic('light');
      return;
    }
    if (status === 'undetermined') {
      const granted = await ensureMotionPermission();
      if (granted) {
        await updatePreferences({ rawAccelRatingEnabled: true });
        triggerHaptic('light');
      } else {
        promptOpenMotionSettings();
      }
      return;
    }
    // Denied at the OS level — can't re-prompt, send them to Settings.
    promptOpenMotionSettings();
  };

  const ensureNotificationPermissions = async (): Promise<boolean> => {
    if (hasNotifications) return true;
    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert(
        t('preferences.notifDisabledTitle'),
        t('preferences.notifDisabledBody'),
        [{ text: t('common.ok') }]
      );
    }
    return granted;
  };

  const handleNotificationSoundToggle = async (value: boolean) => {
    try {
      if (value) {
        const granted = await ensureNotificationPermissions();
        if (!granted) return;
      }
      await updatePreferences({
        notifications: { ...preferences.notifications, sound: value, enabled: value || preferences.notifications.vibration },
      });
      triggerHaptic('light');
    } catch (error) {
      console.error('Failed to update notification sound setting:', error);
      triggerHaptic('error');
    }
  };

  const handleNotificationVibrationToggle = async (value: boolean) => {
    try {
      if (value) {
        const granted = await ensureNotificationPermissions();
        if (!granted) return;
      }
      await updatePreferences({
        notifications: { ...preferences.notifications, vibration: value, enabled: value || preferences.notifications.sound },
      });
      triggerHaptic('light');
    } catch (error) {
      console.error('Failed to update notification vibration setting:', error);
      triggerHaptic('error');
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
          {t('settings.tab.preferences')}
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* General */}
        <SettingsSection title={t('preferences.general')}>
          <SettingsItem
            title={t('settings.language.title')}
            subtitle={t('settings.language.subtitle')}
            icon="language-outline"
            hasChevron
            valueLabel={getLanguageByCode(preferences.language)?.nativeName}
            onPress={() => {
              triggerHaptic('light');
              setLanguageSheetVisible(true);
            }}
            isLast
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title={t('preferences.notifications')}>
          <SettingsItem
            title={t('preferences.notifications')}
            subtitle={t('preferences.notificationsSub')}
            icon="notifications-outline"
            hasChevron
            valueLabel={
              preferences.notifications.sound && preferences.notifications.vibration
                ? t('preferences.soundVibrate')
                : preferences.notifications.sound
                ? t('preferences.sound')
                : preferences.notifications.vibration
                ? t('preferences.vibrate')
                : t('preferences.off')
            }
            onPress={() => {
              triggerHaptic('light');
              setNotificationSheetVisible(true);
            }}
            isLast
          />
        </SettingsSection>

        {/* Goals */}
        <SettingsSection title={t('preferences.goals')}>
          <View className="py-3">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-1">
              {t('preferences.restDays')}
            </Typography>
            <Typography variant="body-12" color="secondary" className="mb-2">
              {t('preferences.restDaysSub')}
            </Typography>
            <View className="flex-row gap-x-2">
              {t('preferences.dayInitials').split(',').map((label, dayIndex) => {
                const isSelected = (preferences.restDays ?? [0, 6]).includes(dayIndex);
                return (
                  <Pressable
                    key={dayIndex}
                    onPress={async () => {
                      const current = preferences.restDays ?? [0, 6];
                      const next = isSelected
                        ? current.filter((d: number) => d !== dayIndex)
                        : [...current, dayIndex].sort((a: number, b: number) => a - b);
                      try {
                        await updatePreferences({ restDays: next } as any);
                        triggerHaptic('light');
                      } catch (error) {
                        console.error('Failed to update rest days:', error);
                      }
                    }}
                    className={`w-9 h-9 rounded-full items-center justify-center ${
                      isSelected ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
                    }`}
                  >
                    <Typography variant="body-12" className="text-white font-poppins-medium">
                      {label}
                    </Typography>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SettingsSection>

        {/* Focus */}
        <SettingsSection title={t('preferences.focusSection')}>
          <SettingsItem
            title={t('preferences.multiTask')}
            subtitle={t('preferences.multiTaskSub')}
            icon="git-branch-outline"
            premiumBadge
            hasToggle
            toggleValue={isPremium && preferences.adhdModeEnabled}
            onToggleChange={handleAdhdModeToggle}
          />
          <SettingsItem
            title={t('preferences.detailedRating')}
            subtitle={t('preferences.detailedRatingSub')}
            icon="walk-outline"
            hasToggle
            toggleValue={!!preferences.rawAccelRatingEnabled}
            onToggleChange={handleDetailedRatingToggle}
          />
          <SettingsItem
            title={t('preferences.timerStyle')}
            subtitle={t('preferences.timerStyleSub')}
            icon="timer-outline"
            hasChevron
            valueLabel={preferences.focus.timerPickerStyle === 'wheel' ? t('preferences.wheel') : t('preferences.scroller')}
            onPress={async () => {
              const current = preferences.focus.timerPickerStyle ?? 'scroller';
              const next = current === 'scroller' ? 'wheel' : 'scroller';
              try {
                await updatePreferences({
                  focus: { ...preferences.focus, timerPickerStyle: next },
                });
                triggerHaptic('light');
              } catch (error) {
                console.error('Failed to update timer picker style:', error);
              }
            }}
            isLast
          />
        </SettingsSection>

        <View className="h-20" />
      </ScrollView>

      {/* Notification Settings Bottom Sheet */}
      <BottomSheet
        isVisible={notificationSheetVisible}
        onClose={() => setNotificationSheetVisible(false)}
        height={340}
      >
        <Typography variant="headline-20" color="primary" className="mb-4">
          {t('preferences.notifications')}
        </Typography>

        <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4">
          <View className="flex-row items-center justify-between py-3 border-b border-light-border dark:border-dark-border">
            <View className="flex-row items-center flex-1">
              <View className="w-8 items-center mr-3">
                <Ionicons name="volume-high-outline" size={20} color={isDark ? '#CACACA' : '#8B7355'} />
              </View>
              <Typography variant="subtitle-14-medium" color="primary">
                {t('preferences.sound')}
              </Typography>
            </View>
            <Toggle
              value={preferences.notifications.sound}
              onValueChange={handleNotificationSoundToggle}
              size="medium"
              accessibilityLabel={t('preferences.a11ySound')}
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-light-border dark:border-dark-border">
            <View className="flex-row items-center flex-1">
              <View className="w-8 items-center mr-3">
                <Ionicons name="phone-portrait-outline" size={20} color={isDark ? '#CACACA' : '#8B7355'} />
              </View>
              <Typography variant="subtitle-14-medium" color="primary">
                {t('preferences.vibrate')}
              </Typography>
            </View>
            <Toggle
              value={preferences.notifications.vibration}
              onValueChange={handleNotificationVibrationToggle}
              size="medium"
              accessibilityLabel={t('preferences.a11yVibration')}
            />
          </View>

          <View className="py-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-8 items-center mr-3">
                  <Ionicons name="flag-outline" size={20} color={isDark ? '#CACACA' : '#8B7355'} />
                </View>
                <View className="flex-1">
                  <Typography variant="subtitle-14-medium" color="primary">
                    {t('preferences.goalReminders')}
                  </Typography>
                  <Typography variant="body-12" color="secondary" className="mt-0.5">
                    {t('preferences.goalRemindersSub')}
                  </Typography>
                </View>
              </View>
              <Toggle
                value={preferences.notifications.goalReminderEnabled}
                onValueChange={async (value) => {
                  try {
                    if (value) {
                      const granted = await ensureNotificationPermissions();
                      if (!granted) return;
                    }
                    await updatePreferences({
                      notifications: { ...preferences.notifications, goalReminderEnabled: value },
                    });
                    triggerHaptic('light');
                  } catch (error) {
                    console.error('Failed to update goal reminder setting:', error);
                    triggerHaptic('error');
                  }
                }}
                size="medium"
                accessibilityLabel={t('preferences.a11yGoalReminders')}
              />
            </View>

            {preferences.notifications.goalReminderEnabled && (
              <View className="mt-3 ml-11">
                <TimePicker
                  value={(() => {
                    const [h, m] = (preferences.notifications.goalReminderTime || '20:00').split(':').map(Number);
                    const d = new Date();
                    d.setHours(h, m, 0, 0);
                    return d;
                  })()}
                  onChange={async (date) => {
                    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                    try {
                      await updatePreferences({
                        notifications: { ...preferences.notifications, goalReminderTime: timeStr },
                      });
                      triggerHaptic('light');
                    } catch (error) {
                      console.error('Failed to update goal reminder time:', error);
                    }
                  }}
                  label={t('preferences.reminderTime')}
                />
              </View>
            )}
          </View>
        </View>
      </BottomSheet>

      {/* Language Selector */}
      <LanguageSelectorSheet
        visible={languageSheetVisible}
        onClose={() => setLanguageSheetVisible(false)}
      />

      {/* Multi-Task Mode premium gate */}
      <UpgradePrompt
        isVisible={showAdhdUpgrade}
        onClose={() => setShowAdhdUpgrade(false)}
        onUpgrade={() => router.push('/settings/subscription' as any)}
        limitType="adhd"
      />
    </SafeAreaView>
  );
}
