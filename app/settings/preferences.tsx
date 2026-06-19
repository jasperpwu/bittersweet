import React, { useState } from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Alert, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Typography } from '../../src/components/ui/Typography';
import { Toggle } from '../../src/components/ui/Toggle';
import { SettingsItem, SettingsSection } from '../../src/components/ui/SettingsItem';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { TimePicker } from '../../src/components/ui/TimePicker';
import { useAppSettings } from '../../src/store/unified-store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { UpgradePrompt } from '../../src/components/subscription/UpgradePrompt';

export default function PreferencesScreen() {
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

  const ensureNotificationPermissions = async (): Promise<boolean> => {
    if (hasNotifications) return true;
    const granted = await requestNotificationPermissions();
    if (!granted) {
      Alert.alert(
        'Notifications Disabled',
        'Please enable notifications in your device settings to receive reminders.',
        [{ text: 'OK' }]
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
          Preferences
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Notifications */}
        <SettingsSection title="Notifications">
          <SettingsItem
            title="Notifications"
            subtitle="Sound & vibration settings"
            icon="notifications-outline"
            hasChevron
            valueLabel={
              preferences.notifications.sound && preferences.notifications.vibration
                ? 'Sound & Vibrate'
                : preferences.notifications.sound
                ? 'Sound'
                : preferences.notifications.vibration
                ? 'Vibrate'
                : 'Off'
            }
            onPress={() => {
              triggerHaptic('light');
              setNotificationSheetVisible(true);
            }}
            isLast
          />
        </SettingsSection>

        {/* Goals */}
        <SettingsSection title="Goals">
          <View className="py-3">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-1">
              Rest Days
            </Typography>
            <Typography variant="body-12" color="secondary" className="mb-2">
              Daily goals use a separate target on these days
            </Typography>
            <View className="flex-row gap-x-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, dayIndex) => {
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
        <SettingsSection title="Focus">
          <SettingsItem
            title="Multi-Task Mode"
            subtitle="Add an optional second tag to a session for two activities at once"
            icon="git-branch-outline"
            premiumBadge
            hasToggle
            toggleValue={isPremium && preferences.adhdModeEnabled}
            onToggleChange={handleAdhdModeToggle}
          />
          <SettingsItem
            title="Timer Picker Style"
            subtitle="Choose how you set the timer duration"
            icon="timer-outline"
            hasChevron
            valueLabel={preferences.focus.timerPickerStyle === 'wheel' ? 'Wheel' : 'Scroller'}
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
          Notifications
        </Typography>

        <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4">
          <View className="flex-row items-center justify-between py-3 border-b border-light-border dark:border-dark-border">
            <View className="flex-row items-center flex-1">
              <View className="w-8 items-center mr-3">
                <Ionicons name="volume-high-outline" size={20} color={isDark ? '#CACACA' : '#8B7355'} />
              </View>
              <Typography variant="subtitle-14-medium" color="primary">
                Sound
              </Typography>
            </View>
            <Toggle
              value={preferences.notifications.sound}
              onValueChange={handleNotificationSoundToggle}
              size="medium"
              accessibilityLabel="Toggle notification sound"
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-light-border dark:border-dark-border">
            <View className="flex-row items-center flex-1">
              <View className="w-8 items-center mr-3">
                <Ionicons name="phone-portrait-outline" size={20} color={isDark ? '#CACACA' : '#8B7355'} />
              </View>
              <Typography variant="subtitle-14-medium" color="primary">
                Vibrate
              </Typography>
            </View>
            <Toggle
              value={preferences.notifications.vibration}
              onValueChange={handleNotificationVibrationToggle}
              size="medium"
              accessibilityLabel="Toggle notification vibration"
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
                    Goal Reminders
                  </Typography>
                  <Typography variant="body-12" color="secondary" className="mt-0.5">
                    Daily nudge when behind pace
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
                accessibilityLabel="Toggle goal reminders"
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
                  label="Reminder Time"
                />
              </View>
            )}
          </View>
        </View>
      </BottomSheet>

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
