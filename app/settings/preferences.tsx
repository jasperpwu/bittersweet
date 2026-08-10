import React, { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert,
  Linking,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { colors } from '../../src/config/theme';
import { Toggle } from '../../src/components/ui/Toggle';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { TimePicker } from '../../src/components/ui/TimePicker';
import { useAppSettings } from '../../src/store/unified-store';
import { useFocusActions } from '../../src/store';
import { LanguageSelectorSheet } from '../../src/components/settings/LanguageSelector';
import { getLanguageByCode } from '../../src/i18n/languages';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { useUpgradeFlow } from '../../src/hooks/useTagUpgradeFlow';
import {
  getMotionPermissionStatus,
  ensureMotionPermission,
} from '../../src/services/motionInsights';
import { useTranslation } from 'react-i18next';
import { directionalIcon } from '../../src/utils/directionalIcon';

export default function PreferencesScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { preferences, updatePreferences } = useAppSettings();
  const { snapshotRestDaysChange } = useFocusActions();
  const { isPremium } = useSubscriptionGate();
  const { hasNotifications, triggerHaptic, requestNotificationPermissions } =
    useDeviceIntegration();
  const [notificationSheetVisible, setNotificationSheetVisible] = useState(false);
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const { triggerUpgrade, upgradeModals } = useUpgradeFlow('adhd');

  // The motion-rating toggle mirrors the iOS Motion & Fitness permission directly
  // (motion is used for nothing else), so its displayed state is derived from the
  // live permission rather than a stored flag. Refresh on focus so returning from
  // iOS Settings — where the permission is granted/revoked — updates the toggle.
  const [motionGranted, setMotionGranted] = useState(false);
  const refreshMotionStatus = useCallback(async () => {
    setMotionGranted((await getMotionPermissionStatus()) === 'granted');
  }, []);
  useFocusEffect(
    useCallback(() => {
      refreshMotionStatus();
    }, [refreshMotionStatus])
  );

  const handleAdhdModeToggle = async (value: boolean) => {
    // Premium gate: non-subscribers see the upgrade prompt instead of toggling.
    if (!isPremium) {
      triggerHaptic('light');
      triggerUpgrade();
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
    Alert.alert(t('preferences.motionDeniedTitle'), t('preferences.motionDeniedBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('journal.openSettings'), onPress: () => Linking.openSettings() },
    ]);
  };

  // Turning the rating OFF: motion is used for nothing but this rating, so the
  // Motion & Fitness permission IS the switch — we can't revoke it in-app. Send
  // the user to Settings; the on-focus refresh above then re-reads the permission
  // and updates the toggle when they return.
  const promptDisableMotionSettings = () => {
    Alert.alert(t('preferences.motionDisableTitle'), t('preferences.motionDisableBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('journal.openSettings'), onPress: () => Linking.openSettings() },
    ]);
  };

  // Motion-based focus rating. The toggle mirrors the iOS Motion & Fitness
  // permission (motion is used for nothing else): ON == granted. Turning it on
  // requests the permission; turning it off deep-links to Settings to revoke.
  const handleMotionRatingToggle = async (value: boolean) => {
    if (!value) {
      promptDisableMotionSettings();
      return;
    }
    const status = await getMotionPermissionStatus();
    if (status === 'granted') {
      setMotionGranted(true);
      triggerHaptic('light');
      return;
    }
    if (status === 'undetermined') {
      const granted = await ensureMotionPermission();
      if (granted) {
        setMotionGranted(true);
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
      Alert.alert(t('preferences.notifDisabledTitle'), t('preferences.notifDisabledBody'), [
        { text: t('common.ok') },
      ]);
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
        notifications: {
          ...preferences.notifications,
          sound: value,
          enabled: value || preferences.notifications.vibration,
        },
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
        notifications: {
          ...preferences.notifications,
          vibration: value,
          enabled: value || preferences.notifications.sound,
        },
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
      <View className="h-[56px] flex-row items-center px-5">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <Ionicons
            name={directionalIcon('chevron-back')}
            size={24}
            color={isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary}
          />
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
              {t('preferences.dayInitials')
                .split(',')
                .map((label, dayIndex) => {
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
                          // Version the old layout into every daily goal's
                          // target history first, so already-completed days stay
                          // scored against the rest days they actually had.
                          snapshotRestDaysChange(current, next);
                          await updatePreferences({ restDays: next } as any);
                          triggerHaptic('light');
                        } catch (error) {
                          console.error('Failed to update rest days:', error);
                        }
                      }}
                      className={`h-9 w-9 items-center justify-center rounded-full ${
                        isSelected ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
                      }`}>
                      <Typography variant="body-12" className="font-poppins-medium text-white">
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
            toggleValue={motionGranted}
            onToggleChange={handleMotionRatingToggle}
          />
          <SettingsItem
            title={t('preferences.timerStyle')}
            subtitle={t('preferences.timerStyleSub')}
            icon="timer-outline"
            hasChevron
            valueLabel={
              preferences.focus.timerPickerStyle === 'wheel'
                ? t('preferences.wheel')
                : t('preferences.scroller')
            }
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
        scrollable>
        <Typography variant="headline-20" color="primary" className="mb-4">
          {t('preferences.notifications')}
        </Typography>

        <View className="rounded-2xl bg-light-border/30 px-4 dark:bg-dark-card">
          <View className="flex-row items-center justify-between border-b border-light-border py-3 dark:border-dark-border">
            <View className="flex-1 flex-row items-center">
              <View className="mr-3 w-8 items-center">
                <Ionicons
                  name="volume-high-outline"
                  size={20}
                  color={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
                />
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

          <View className="flex-row items-center justify-between border-b border-light-border py-3 dark:border-dark-border">
            <View className="flex-1 flex-row items-center">
              <View className="mr-3 w-8 items-center">
                <Ionicons
                  name="phone-portrait-outline"
                  size={20}
                  color={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
                />
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
              <View className="flex-1 flex-row items-center">
                <View className="mr-3 w-8 items-center">
                  <Ionicons
                    name="flag-outline"
                    size={20}
                    color={isDark ? colors.dark.textSecondary : colors.light.screenTextSecondary}
                  />
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
              <View className="ml-11 mt-3">
                <TimePicker
                  value={(() => {
                    const [h, m] = (preferences.notifications.goalReminderTime || '20:00')
                      .split(':')
                      .map(Number);
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

      {/* Multi-Task Mode premium gate — prompt → sign-in → subscription sheet */}
      {upgradeModals}
    </SafeAreaView>
  );
}
