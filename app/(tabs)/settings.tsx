import React, { useState } from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Alert, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../src/components/ui/Typography';
import { Toggle } from '../../src/components/ui/Toggle';
import { BottomSheet } from '../../src/components/ui/BottomSheet';
import { useAppSettings } from '../../src/store/unified-store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { useBlocklist, useBlocklistActions } from '../../src/store';
import { router } from 'expo-router';

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
  return (
    <Pressable
      onPress={onPress}
      disabled={hasToggle && !onPress}
      className={`
        w-full flex-row items-center py-3
        ${!hasToggle ? 'active:opacity-70' : ''}
        ${!isLast ? 'border-b border-dark-border' : ''}
      `}
    >
      {icon && (
        <View className="w-8 items-center mr-3">
          <Ionicons name={icon} size={20} color="#CACACA" />
        </View>
      )}

      <View className="flex-1 mr-3">
        <Typography variant="subtitle-14-medium" color="white">
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
        <Ionicons name="chevron-forward" size={16} color="#575757" />
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
      <Typography variant="subtitle-14-medium" className="text-primary mb-3">
        {title}
      </Typography>
      <View className="bg-[#242540] rounded-2xl px-4">
        {children}
      </View>
    </View>
  );
};

// --- Main screen ---

export default function SettingsScreen() {
  const { preferences, updatePreferences, theme } = useAppSettings();
  const {
    hasNotifications,
    triggerHaptic,
    requestNotificationPermissions,
    deviceInfo
  } = useDeviceIntegration();
  const { settings: blocklistSettings } = useBlocklist();
  const { checkAuthorizationStatus, requestAuthorization } = useBlocklistActions();
  const [notificationSheetVisible, setNotificationSheetVisible] = useState(false);

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

  const handleNightModeToggle = async (value: boolean) => {
    try {
      await updatePreferences({ theme: value ? 'dark' : 'light' });
      triggerHaptic('light');
    } catch (error) {
      console.error('Failed to update theme setting:', error);
      triggerHaptic('error');
    }
  };

  const handleBlockList = async () => {
    triggerHaptic('light');
    const authorized = await checkAuthorizationStatus();
    if (!authorized) {
      const granted = await requestAuthorization();
      if (granted) {
        await checkAuthorizationStatus();
        router.push('/(modals)/app-selection');
      } else {
        Alert.alert(
          'Authorization Required',
          'Family Controls permission is required to use app blocking features. Please enable it in Settings.',
          [{ text: 'OK' }]
        );
      }
    } else {
      router.push('/(modals)/app-selection');
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

  const handleSendFeedback = () => {
    triggerHaptic('light');
    Linking.openURL('mailto:junxwoo@icloud.com?subject=Bittersweet%20Feedback');
  };

  const handleHelpCenter = () => {
    triggerHaptic('light');
    console.log('Open help center');
  };

  // Compute block list count
  const getBlockedCount = () => {
    const totalApps = blocklistSettings.blockedApps.applicationTokens[0]?.displayName?.match(/(\d+)/)?.[0] || 0;
    const totalCategories = blocklistSettings.blockedApps.categoryTokens[0]?.displayName?.match(/(\d+)/)?.[0] || 0;
    const totalDomains = blocklistSettings.blockedApps.webDomainTokens[0]?.displayName?.match(/(\d+)/)?.[0] || 0;
    return Number(totalApps) + Number(totalCategories) + Number(totalDomains);
  };

  const blockedCount = getBlockedCount();

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="h-[56px] px-5 flex-row items-center">
        <Typography variant="headline-24" color="white">
          Settings
        </Typography>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Motivational Quote */}
        <View className="px-5 pt-2 pb-2">
          <Typography variant="headline-20" color="white">
            Make today count.
          </Typography>
          <Typography variant="body-14" color="secondary" className="mt-1">
            Every focused minute is an investment in yourself.
          </Typography>
        </View>

        {/* Focus & Blocking */}
        <SettingsSection title="Focus & Blocking">
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
          />
          <SettingsItem
            title="Block List"
            subtitle="Manage blocked apps during focus"
            icon="ban-outline"
            hasChevron
            valueLabel={blockedCount > 0 ? `${blockedCount} blocked` : 'None'}
            onPress={handleBlockList}
            isLast
          />
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Appearance">
          <SettingsItem
            title="Night Mode"
            subtitle="Use dark theme"
            icon="moon-outline"
            hasToggle
            toggleValue={theme === 'dark'}
            onToggleChange={handleNightModeToggle}
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
            title="Send Feedback"
            subtitle="junxwoo@icloud.com"
            icon="mail-outline"
            hasChevron
            onPress={handleSendFeedback}
            isLast
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="About">
          <SettingsItem
            title="Version"
            icon="information-circle-outline"
            valueLabel="1.0.0"
          />
          <SettingsItem
            title="Help Center"
            icon="help-circle-outline"
            hasChevron
            onPress={handleHelpCenter}
            isLast
          />
        </SettingsSection>

        {/* Developer (dev only) */}
        {__DEV__ && (
          <View className="px-5 mt-6">
            <Typography variant="subtitle-14-medium" className="text-primary mb-3">
              Developer
            </Typography>

            <Pressable
              onPress={() => router.push('/(modals)/dev-tools')}
              className="bg-[#242540] rounded-2xl py-3 px-4 mb-4 active:opacity-80"
            >
              <Typography variant="subtitle-14-semibold" color="primary">
                Open Dev Tools
              </Typography>
            </Pressable>

            <View className="bg-[#242540] rounded-2xl p-4">
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

      {/* Notification Settings Snackbar */}
      <BottomSheet
        isVisible={notificationSheetVisible}
        onClose={() => setNotificationSheetVisible(false)}
        height={200}
      >
        <Typography variant="headline-20" color="white" className="mb-4">
          Notifications
        </Typography>

        <View className="bg-[#242540] rounded-2xl px-4">
          <View className="flex-row items-center justify-between py-3 border-b border-dark-border">
            <View className="flex-row items-center flex-1">
              <View className="w-8 items-center mr-3">
                <Ionicons name="volume-high-outline" size={20} color="#CACACA" />
              </View>
              <Typography variant="subtitle-14-medium" color="white">
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

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center flex-1">
              <View className="w-8 items-center mr-3">
                <Ionicons name="phone-portrait-outline" size={20} color="#CACACA" />
              </View>
              <Typography variant="subtitle-14-medium" color="white">
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
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
