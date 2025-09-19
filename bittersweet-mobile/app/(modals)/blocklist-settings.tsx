import React, { useState } from 'react';
import {
  View,
  ScrollView,
  SafeAreaView,
  Pressable,
  Alert
} from 'react-native';
import { Typography } from '../../src/components/ui/Typography';
import { Toggle } from '../../src/components/ui/Toggle';
import { useBlocklist, useBlocklistActions, useRewards } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { router, useFocusEffect } from 'expo-router';

interface SettingsRowProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  title,
  subtitle,
  rightElement,
  onPress,
  disabled = false
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      className={`
        flex-row items-center justify-between py-4 px-5 border-b border-dark-border
        ${onPress && !disabled ? 'active:opacity-70' : ''}
        ${disabled ? 'opacity-50' : ''}
      `}
    >
      <View className="flex-1">
        <Typography variant="body-14" color="white">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body-12" color="secondary" className="mt-1">
            {subtitle}
          </Typography>
        )}
      </View>
      {rightElement && (
        <View className="ml-4">
          {rightElement}
        </View>
      )}
    </Pressable>
  );
};

interface BlockedAppItemProps {
  app: {
    id: string;
    bundleIdentifier: string;
    displayName: string;
    iconData?: string;
  };
  onRemove: () => void;
}

const BlockedAppItem: React.FC<BlockedAppItemProps> = ({ app, onRemove }) => {
  return (
    <View className="flex-row items-center justify-between py-3 px-5 border-b border-dark-border">
      <View className="flex-1 flex-row items-center">
        <View className="w-8 h-8 bg-dark-border rounded-lg items-center justify-center mr-3">
          <Typography variant="body-12" color="white">
            📱
          </Typography>
        </View>
        <View className="flex-1">
          <Typography variant="body-14" color="white">
            {app.displayName}
          </Typography>
          <Typography variant="body-12" color="secondary" className="mt-0.5">
            {app.bundleIdentifier}
          </Typography>
        </View>
      </View>
      <Pressable
        onPress={onRemove}
        className="w-8 h-8 items-center justify-center active:opacity-70"
      >
        <Typography variant="body-16" color="destructive">
          ×
        </Typography>
      </Pressable>
    </View>
  );
};

export default function BlocklistSettingsScreen() {
  const { triggerHaptic } = useDeviceIntegration();
  const { balance } = useRewards();
  const {
    settings,
    isAuthorized,
    authorizationStatus,
    activeSessions,
    getDailyUnlockCount,
    getRemainingUnlocks
  } = useBlocklist();

  // Debug logging
  console.log('🔍 BlocklistSettingsScreen render - isAuthorized:', isAuthorized);
  console.log('🔍 BlocklistSettingsScreen render - authorizationStatus:', authorizationStatus);
  console.log('🔍 BlocklistSettingsScreen render - settings.blockedApps:', settings.blockedApps);
  console.log('🔍 BlocklistSettingsScreen render - applicationTokens count:', settings.blockedApps.applicationTokens.length);
  console.log('🔍 BlocklistSettingsScreen render - categoryTokens count:', settings.blockedApps.categoryTokens.length);
  console.log('🔍 BlocklistSettingsScreen render - webDomainTokens count:', settings.blockedApps.webDomainTokens.length);
  const {
    checkAuthorizationStatus,
    requestAuthorization,
    updateSettings,
    updateBlockedApps
  } = useBlocklistActions();

  const [isRequestingAuth, setIsRequestingAuth] = useState(false);

  // Check authorization status when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔍 Blocklist screen focused, checking authorization status...');
      checkAuthorizationStatus();
    }, [checkAuthorizationStatus])
  );

  const handleClose = () => {
    triggerHaptic('light');
    router.back();
  };

  const handleCheckAuthStatus = async () => {
    console.log('🔍 Manual authorization status check triggered');
    const result = await checkAuthorizationStatus();
    Alert.alert(
      'Debug: Authorization Status',
      `Current status: ${authorizationStatus}\nIs Authorized: ${result}`,
      [{ text: 'OK' }]
    );
  };

  const handleRequestAuthorization = async () => {
    if (isRequestingAuth) return;

    setIsRequestingAuth(true);
    triggerHaptic('light');

    try {
      const granted = await requestAuthorization();
      if (granted) {
        Alert.alert(
          'Authorization Granted',
          'You can now configure app blocking settings.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Authorization Required',
          'Family Controls permission is required to use app blocking features. Please enable it in Settings.',
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert(
        'Error',
        'Failed to request authorization. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsRequestingAuth(false);
    }
  };

  const handleToggleEnabled = (enabled: boolean) => {
    triggerHaptic('light');
    updateSettings({ isEnabled: enabled });
  };

  const handleAddApps = () => {
    triggerHaptic('light');
    router.push('/(modals)/app-selection');
  };

  const handleRemoveApp = (appId: string) => {
    triggerHaptic('light');
    const updatedApps = {
      ...settings.blockedApps,
      applicationTokens: settings.blockedApps.applicationTokens.filter(
        app => app.id !== appId
      )
    };
    updateBlockedApps(updatedApps);
  };

  const handleCostChange = (increment: boolean) => {
    triggerHaptic('light');
    const newCost = increment
      ? Math.min(settings.unlockCostPerMinute + 1, 10)
      : Math.max(settings.unlockCostPerMinute - 1, 1);
    updateSettings({ unlockCostPerMinute: newCost });
  };

  const handleMaxDurationChange = (increment: boolean) => {
    triggerHaptic('light');
    const newDuration = increment
      ? Math.min(settings.maxUnlockDuration + 15, 180)
      : Math.max(settings.maxUnlockDuration - 15, 15);
    updateSettings({ maxUnlockDuration: newDuration });
  };

  const dailyUnlockCount = getDailyUnlockCount();
  const remainingUnlocks = getRemainingUnlocks();
  const hasActiveUnlocks = Object.values(activeSessions.byId).some(session => session.isActive);

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="h-[76px] px-5 flex-row items-center justify-between border-b border-dark-border">
        <Typography variant="headline-18" color="white">
          Block List
        </Typography>
        <Pressable onPress={handleClose} className="active:opacity-70">
          <Typography variant="body-14" className="text-primary">
            Done
          </Typography>
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Authorization Status */}
        {!isAuthorized && (
          <View className="mx-5 mt-6 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <Typography variant="subtitle-14-medium" color="orange" className="mb-2">
              Authorization Required
            </Typography>
            <Typography variant="body-12" color="secondary" className="mb-3">
              Family Controls permission is needed to block apps. This allows the app to manage screen time restrictions.
            </Typography>
            <Pressable
              onPress={handleRequestAuthorization}
              disabled={isRequestingAuth}
              className="bg-orange-500 px-4 py-2 rounded-lg active:opacity-80 disabled:opacity-50 mb-2"
            >
              <Typography variant="body-14" color="white" className="text-center">
                {isRequestingAuth ? 'Requesting...' : 'Request Permission'}
              </Typography>
            </Pressable>
            <Pressable
              onPress={handleCheckAuthStatus}
              className="bg-blue-500 px-4 py-2 rounded-lg active:opacity-80"
            >
              <Typography variant="body-14" color="white" className="text-center">
                Debug: Check Status
              </Typography>
            </Pressable>
          </View>
        )}

        {/* Main Toggle */}
        <View className="mt-6">
          <SettingsRow
            title="Enable App Blocking"
            subtitle={isAuthorized ? "Block selected apps during focus sessions" : "Authorization required"}
            disabled={!isAuthorized}
            rightElement={
              <Toggle
                value={settings.isEnabled && isAuthorized}
                onValueChange={handleToggleEnabled}
                disabled={!isAuthorized}
                size="medium"
              />
            }
          />
        </View>

        {isAuthorized && settings.isEnabled && (
          <>
            {/* Status Overview */}
            <View className="mx-5 mt-6 p-4 bg-dark-surface rounded-lg">
              <Typography variant="subtitle-14-medium" color="white" className="mb-3">
                Today&apos;s Usage
              </Typography>
              <View className="flex-row justify-between mb-2">
                <Typography variant="body-12" color="secondary">
                  Fruits Available
                </Typography>
                <Typography variant="body-12" color="primary">
                  {balance} 🍎
                </Typography>
              </View>
              <View className="flex-row justify-between mb-2">
                <Typography variant="body-12" color="secondary">
                  Unlocks Used
                </Typography>
                <Typography variant="body-12" color="white">
                  {dailyUnlockCount} / {settings.allowedUnlocksPerDay}
                </Typography>
              </View>
              <View className="flex-row justify-between">
                <Typography variant="body-12" color="secondary">
                  Remaining Unlocks
                </Typography>
                <Typography variant="body-12" color={remainingUnlocks > 0 ? "primary" : "destructive"}>
                  {remainingUnlocks}
                </Typography>
              </View>
              {hasActiveUnlocks && (
                <View className="mt-3 pt-3 border-t border-dark-border">
                  <Typography variant="body-12" color="green" className="text-center">
                    🟢 Apps currently unlocked
                  </Typography>
                </View>
              )}
            </View>

            {/* Blocked Apps Section */}
            <View className="mt-6">
              <View className="px-5 mb-3">
                <Typography variant="subtitle-14-medium" color="white">
                  Blocked Apps ({settings.blockedApps.applicationTokens.length})
                </Typography>
              </View>

              {settings.blockedApps.applicationTokens.length === 0 ? (
                <View className="mx-5 p-4 bg-dark-surface rounded-lg">
                  <Typography variant="body-12" color="secondary" className="text-center mb-3">
                    No apps blocked yet
                  </Typography>
                  <Pressable
                    onPress={handleAddApps}
                    className="bg-primary px-4 py-2 rounded-lg active:opacity-80"
                  >
                    <Typography variant="body-14" color="white" className="text-center">
                      Add Apps to Block
                    </Typography>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View className="bg-dark-surface mx-5 rounded-lg overflow-hidden">
                    {settings.blockedApps.applicationTokens.map((app) => (
                      <BlockedAppItem
                        key={app.id}
                        app={app}
                        onRemove={() => handleRemoveApp(app.id)}
                      />
                    ))}
                  </View>
                  <View className="mx-5 mt-3">
                    <Pressable
                      onPress={handleAddApps}
                      className="border border-primary border-dashed py-3 rounded-lg active:opacity-70"
                    >
                      <Typography variant="body-14" color="primary" className="text-center">
                        + Add More Apps
                      </Typography>
                    </Pressable>
                  </View>
                </>
              )}
            </View>

            {/* Unlock Settings */}
            <View className="mt-6">
              <View className="px-5 mb-3">
                <Typography variant="subtitle-14-medium" color="white">
                  Unlock Settings
                </Typography>
              </View>

              <View className="bg-dark-surface mx-5 rounded-lg overflow-hidden">
                <SettingsRow
                  title="Cost per Minute"
                  subtitle={`${settings.unlockCostPerMinute} fruit${settings.unlockCostPerMinute !== 1 ? 's' : ''} per minute`}
                  rightElement={
                    <View className="flex-row items-center">
                      <Pressable
                        onPress={() => handleCostChange(false)}
                        className="w-8 h-8 items-center justify-center bg-dark-border rounded-full active:opacity-70"
                      >
                        <Typography variant="body-16" color="white">-</Typography>
                      </Pressable>
                      <Typography variant="body-14" color="primary" className="mx-3 min-w-[24px] text-center">
                        {settings.unlockCostPerMinute}
                      </Typography>
                      <Pressable
                        onPress={() => handleCostChange(true)}
                        className="w-8 h-8 items-center justify-center bg-dark-border rounded-full active:opacity-70"
                      >
                        <Typography variant="body-16" color="white">+</Typography>
                      </Pressable>
                    </View>
                  }
                />

                <SettingsRow
                  title="Max Unlock Duration"
                  subtitle={`Up to ${settings.maxUnlockDuration} minutes per session`}
                  rightElement={
                    <View className="flex-row items-center">
                      <Pressable
                        onPress={() => handleMaxDurationChange(false)}
                        className="w-8 h-8 items-center justify-center bg-dark-border rounded-full active:opacity-70"
                      >
                        <Typography variant="body-16" color="white">-</Typography>
                      </Pressable>
                      <Typography variant="body-14" color="primary" className="mx-3 min-w-[32px] text-center">
                        {settings.maxUnlockDuration}
                      </Typography>
                      <Pressable
                        onPress={() => handleMaxDurationChange(true)}
                        className="w-8 h-8 items-center justify-center bg-dark-border rounded-full active:opacity-70"
                      >
                        <Typography variant="body-16" color="white">+</Typography>
                      </Pressable>
                    </View>
                  }
                />

                <SettingsRow
                  title="Daily Unlock Limit"
                  subtitle={`Maximum ${settings.allowedUnlocksPerDay} unlock sessions per day`}
                  rightElement={
                    <View className="flex-row items-center">
                      <Pressable
                        onPress={() => updateSettings({
                          allowedUnlocksPerDay: Math.max(1, settings.allowedUnlocksPerDay - 1)
                        })}
                        className="w-8 h-8 items-center justify-center bg-dark-border rounded-full active:opacity-70"
                      >
                        <Typography variant="body-16" color="white">-</Typography>
                      </Pressable>
                      <Typography variant="body-14" color="primary" className="mx-3 min-w-[24px] text-center">
                        {settings.allowedUnlocksPerDay}
                      </Typography>
                      <Pressable
                        onPress={() => updateSettings({
                          allowedUnlocksPerDay: Math.min(20, settings.allowedUnlocksPerDay + 1)
                        })}
                        className="w-8 h-8 items-center justify-center bg-dark-border rounded-full active:opacity-70"
                      >
                        <Typography variant="body-16" color="white">+</Typography>
                      </Pressable>
                    </View>
                  }
                />
              </View>
            </View>

            {/* Help Text */}
            <View className="mx-5 mt-6 mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <Typography variant="body-12" color="secondary" className="text-center">
                💡 Apps will be blocked when this feature is enabled. You can temporarily unlock them by spending fruits you&apos;ve earned from focus sessions.
              </Typography>
            </View>
          </>
        )}

        {/* Bottom spacing for safe area */}
        <View className="h-20" />
      </ScrollView>
    </SafeAreaView>
  );
}