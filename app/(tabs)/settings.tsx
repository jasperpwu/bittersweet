import React, { useState } from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Alert, Share, Linking, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { Toggle } from '../../src/components/ui/Toggle';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { useAppSettings } from '../../src/store/unified-store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { TimePicker } from '../../src/components/ui/TimePicker';
import { router } from 'expo-router';
import { AccountSection } from '../../src/components/auth/AccountSection';
import { UpgradeSheet } from '../../src/components/subscription/UpgradeSheet';
import { useAppStore } from '../../src/store';
import { openChat } from '../../src/services/crisp';

// --- Inline sub-components ---

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  hasChevron?: boolean;
  valueLabel?: string;
  onPress?: () => void;
  isLast?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  subtitle,
  icon,
  hasToggle = false,
  toggleValue = false,
  onToggleChange,
  hasChevron = false,
  valueLabel,
  onPress,
  isLast = false,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`
        w-full flex-row items-center py-3
        ${onPress ? 'active:opacity-70' : ''}
        ${!isLast ? 'border-b border-light-border dark:border-dark-border' : ''}
      `}
    >
      {icon && (
        <View className="w-8 items-center mr-3">
          <Ionicons name={icon} size={20} color={isDark ? '#CACACA' : '#8B7355'} />
        </View>
      )}

      <View className="flex-1 mr-3">
        <Typography variant="subtitle-14-medium" color="primary">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body-12" color="secondary" className="mt-0.5">
            {subtitle}
          </Typography>
        )}
      </View>

      {hasToggle && onToggleChange && (
        <Toggle
          value={toggleValue}
          onValueChange={onToggleChange}
          size="medium"
          accessibilityLabel={`Toggle ${title}`}
        />
      )}

      {valueLabel && (
        <Typography variant="body-12" color="secondary" className="mr-1">
          {valueLabel}
        </Typography>
      )}

      {hasChevron && (
        <Ionicons name="chevron-forward" size={16} color={isDark ? '#575757' : '#D4C4A8'} />
      )}
    </Pressable>
  );
};

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => {
  return (
    <View className="px-5 mt-6">
      <Typography variant="subtitle-14-medium" className="text-primary-light dark:text-primary mb-3">
        {title}
      </Typography>
      <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl px-4">
        {children}
      </View>
    </View>
  );
};

// --- Main screen ---

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const { preferences, updatePreferences } = useAppSettings();
  const {
    hasNotifications,
    triggerHaptic,
    requestNotificationPermissions,
    deviceInfo
  } = useDeviceIntegration();
  const [notificationSheetVisible, setNotificationSheetVisible] = useState(false);
  const [upgradeSheetVisible, setUpgradeSheetVisible] = useState(false);
  const subscriptionTier = useAppStore((state) => state.subscription.tier);

  // --- Handlers ---

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

  const handleShareWithFriends = async () => {
    triggerHaptic('light');
    try {
      await Share.share({
        message: 'Check out Bittersweet — a focus timer that helps you stay productive! https://apps.apple.com/app/bittersweet',
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const handleHelpAndFeedback = () => {
    triggerHaptic('light');
    openChat();
  };

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
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

        {/* Account */}
        <AccountSection />

        {/* Subscription */}
        <SettingsSection title="Subscription">
          {subscriptionTier === 'premium' ? (
            <>
              <SettingsItem
                title="Premium"
                subtitle="All features unlocked"
                icon="diamond-outline"
                valueLabel="Active"
              />
              <SettingsItem
                title="Manage Subscription"
                subtitle="Change or cancel in iOS Settings"
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
              title="Free Plan"
              subtitle="Upgrade for unlimited tags & goals"
              icon="diamond-outline"
              hasChevron
              valueLabel="Upgrade"
              onPress={() => {
                triggerHaptic('light');
                setUpgradeSheetVisible(true);
              }}
              isLast
            />
          )}
        </SettingsSection>

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
          {/* Rest Days */}
          <View className="py-3 border-b border-light-border dark:border-dark-border">
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
                        ? current.filter(d => d !== dayIndex)
                        : [...current, dayIndex].sort((a, b) => a - b);
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

          {/* Week Starts On */}
          <View className="py-3">
            <Typography variant="subtitle-14-medium" color="primary" className="mb-1">
              Week Starts On
            </Typography>
            <Typography variant="body-12" color="secondary" className="mb-2">
              Affects weekly goal period boundaries
            </Typography>
            <View className="flex-row gap-x-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, dayIndex) => {
                const isSelected = (preferences.weekStartDay ?? 0) === dayIndex;
                return (
                  <Pressable
                    key={dayIndex}
                    onPress={async () => {
                      try {
                        await updatePreferences({ weekStartDay: dayIndex } as any);
                        triggerHaptic('light');
                      } catch (error) {
                        console.error('Failed to update week start day:', error);
                      }
                    }}
                    className={`flex-1 py-2 rounded-lg items-center ${
                      isSelected ? 'bg-primary' : 'bg-light-border dark:bg-dark-border'
                    }`}
                  >
                    <Typography variant="tiny-10" className="text-white font-poppins-medium">
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

        {/* Support */}
        <SettingsSection title="Support">
          <SettingsItem
            title="Share with Friends"
            subtitle="Spread the focus"
            icon="share-social-outline"
            hasChevron
            onPress={handleShareWithFriends}
          />
          <SettingsItem
            title="Help & Feedback"
            subtitle="Chat with us"
            icon="chatbubble-ellipses-outline"
            hasChevron
            onPress={handleHelpAndFeedback}
            isLast
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingsItem
            title="Version"
            icon="information-circle-outline"
            valueLabel="1.0.0"
            isLast
          />
        </SettingsSection>

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
              <Typography variant="body-12" color="secondary" className="mt-1">
                Notifications: {hasNotifications ? 'Enabled' : 'Disabled'}
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

      {/* Notification Settings Snackbar */}
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
                <Ionicons name="volume-high-outline" size={20} color={colorScheme === 'dark' ? '#CACACA' : '#8B7355'} />
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
                <Ionicons name="phone-portrait-outline" size={20} color={colorScheme === 'dark' ? '#CACACA' : '#8B7355'} />
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
                  <Ionicons name="flag-outline" size={20} color={colorScheme === 'dark' ? '#CACACA' : '#8B7355'} />
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
    </SafeAreaView>
  );
}
