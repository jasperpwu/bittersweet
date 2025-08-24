import React from 'react';
import { View, ScrollView, SafeAreaView, Pressable, Alert } from 'react-native';
import { Typography } from '../../src/components/ui/Typography';
import { Avatar } from '../../src/components/ui/Avatar';
import { Toggle } from '../../src/components/ui/Toggle';
import { useAuth, useSettings } from '../../src/store/unified-store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';

interface SettingsItemProps {
  title: string;
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  hasArrow?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  hasToggle = false,
  toggleValue = false,
  onToggleChange,
  hasArrow = false,
  onPress,
  disabled = false,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || hasToggle}
      className={`
        h-[47px] w-full flex-row items-center justify-between px-0 py-0
        ${!hasToggle && !disabled ? 'active:opacity-70' : ''}
      `}
    >
      <Typography variant="body-14" color="white">
        {title}
      </Typography>
      
      {hasToggle && onToggleChange && (
        <Toggle
          value={toggleValue}
          onValueChange={onToggleChange}
          size="medium"
          accessibilityLabel={`Toggle ${title}`}
        />
      )}
      
      {hasArrow && (
        <View className="w-6 h-6 items-center justify-center">
          <Typography variant="body-14" color="secondary">
            ›
          </Typography>
        </View>
      )}
    </Pressable>
  );
};

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { preferences, updatePreferences, theme } = useSettings();
  const { 
    hasNotifications, 
    triggerHaptic, 
    requestNotificationPermissions,
    deviceInfo 
  } = useDeviceIntegration();

  const handleLogout = () => {
    triggerHaptic('light');
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => triggerHaptic('light'),
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              triggerHaptic('success');
              // For now, just show success - would navigate to auth in real app
              Alert.alert('Logged Out', 'You have been successfully logged out.');
            } catch (error) {
              triggerHaptic('error');
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleNotificationsToggle = async (value: boolean) => {
    try {
      // Request permissions if enabling notifications
      if (value && !hasNotifications) {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          Alert.alert(
            'Notifications Disabled',
            'Please enable notifications in your device settings to receive reminders.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      await updatePreferences({
        notifications: {
          ...preferences.notifications,
          enabled: value,
        },
      });

      // Provide haptic feedback
      triggerHaptic('light');
    } catch (error) {
      console.error('Failed to update notifications setting:', error);
      triggerHaptic('error');
    }
  };

  const handleNightModeToggle = async (value: boolean) => {
    try {
      await updatePreferences({
        theme: value ? 'dark' : 'light',
      });
      
      // Provide haptic feedback
      triggerHaptic('light');
    } catch (error) {
      console.error('Failed to update theme setting:', error);
      triggerHaptic('error');
    }
  };

  const handleDoNotDisturbToggle = (value: boolean) => {
    // This would integrate with system DND settings
    console.log('Do not disturb:', value);
  };

  const handleReminderToggle = async (value: boolean) => {
    try {
      await updatePreferences({
        notifications: {
          ...preferences.notifications,
          sessionReminders: value,
        },
      });
      
      // Provide haptic feedback
      triggerHaptic('light');
    } catch (error) {
      console.error('Failed to update reminder setting:', error);
      triggerHaptic('error');
    }
  };

  const handleReminderRingtone = () => {
    // Navigate to ringtone selection
    console.log('Open ringtone selection');
  };

  const handleProfile = () => {
    // Navigate to profile screen
    console.log('Open profile');
  };

  const handleSecureAccount = () => {
    // Navigate to security settings
    console.log('Open security settings');
  };

  const handleHelpCenter = () => {
    // Navigate to help center
    console.log('Open help center');
  };

  const handleAvatarEdit = () => {
    // Open avatar editor
    console.log('Edit avatar');
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="h-[76px] px-5 flex-row items-center justify-between">
        <Typography variant="headline-18" color="white">
          Settings
        </Typography>
        <Pressable onPress={handleLogout} className="active:opacity-70">
          <Typography variant="body-14" className="text-error">
            Log out
          </Typography>
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View className="px-5 py-4 flex-row items-center">
          <Avatar
            size="large"
            source={user?.avatar}
            name={user?.name}
            showEditButton={true}
            onEditPress={handleAvatarEdit}
          />
          <View className="ml-4 flex-1">
            <Typography variant="subtitle-16" color="white">
              {user?.name || 'Artiom Larin'}
            </Typography>
            <Typography variant="body-14" color="secondary" className="mt-1">
              {user?.email || 'iseeyoowhen@gmail.com'}
            </Typography>
          </View>
        </View>

        {/* General Settings Section */}
        <View className="px-5 mt-6">
          <Typography variant="subtitle-14-medium" color="white" className="mb-4">
            General settings
          </Typography>

          <View className="space-y-2">
            <SettingsItem
              title="Notifications"
              hasToggle={true}
              toggleValue={preferences.notifications.enabled}
              onToggleChange={handleNotificationsToggle}
            />

            <SettingsItem
              title="Night mode"
              hasToggle={true}
              toggleValue={theme === 'dark'}
              onToggleChange={handleNightModeToggle}
            />

            <SettingsItem
              title="Do not disturb"
              hasToggle={true}
              toggleValue={false} // This would come from system settings
              onToggleChange={handleDoNotDisturbToggle}
            />

            <SettingsItem
              title="Reminder"
              hasToggle={true}
              toggleValue={preferences.notifications.sessionReminders}
              onToggleChange={handleReminderToggle}
            />

            <SettingsItem
              title="Reminder ringtone"
              hasArrow={true}
              onPress={handleReminderRingtone}
            />

            <SettingsItem
              title="Profile"
              hasArrow={true}
              onPress={handleProfile}
            />

            <SettingsItem
              title="Secure account"
              hasArrow={true}
              onPress={handleSecureAccount}
            />

            <SettingsItem
              title="Help center"
              hasArrow={true}
              onPress={handleHelpCenter}
            />
          </View>
        </View>

        {/* Debug Info Section (Development Only) */}
        {__DEV__ && (
          <View className="px-5 mt-6">
            <Typography variant="subtitle-14-medium" color="white" className="mb-4">
              Device Info (Debug)
            </Typography>
            <View className="bg-dark-border rounded-lg p-4">
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

        {/* Bottom spacing for tab bar */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}