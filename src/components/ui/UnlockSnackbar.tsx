import React, { useState } from 'react';
import {
  View,
  Pressable,
  Animated,
  Alert
} from 'react-native';
import { Typography } from './Typography';
import { useBlocklist, useBlocklistActions, useRewards } from '../../store';
import { useDeviceIntegration } from '../../hooks/useDeviceIntegration';
import { unblockSelection, startMonitoring, stopMonitoring, configureActions } from 'react-native-device-activity';
import { LiveActivityService } from '../../services/LiveActivityService';

interface UnlockOptionProps {
  duration: number;
  cost: number;
  onSelect: () => void;
  disabled?: boolean;
  isSelected?: boolean;
}

const UnlockOption: React.FC<UnlockOptionProps> = ({
  duration,
  cost,
  onSelect,
  disabled = false,
  isSelected = false
}) => {
  return (
    <Pressable
      onPress={onSelect}
      disabled={disabled}
      className={`
        px-3 py-2 rounded-lg border active:opacity-80 mr-2
        ${isSelected
          ? 'border-primary bg-primary/20'
          : 'border-gray-600 bg-gray-800'
        }
        ${disabled ? 'opacity-50' : ''}
      `}
    >
      <View className="items-center">
        <Typography variant="body-12" color="white">
          {duration}m
        </Typography>
        <Typography variant="tiny-10" color="primary">
          {cost} 🍎
        </Typography>
      </View>
    </Pressable>
  );
};

interface UnlockSnackbarProps {
  visible: boolean;
  onDismiss: () => void;
  appName?: string;
  balance?: number;
}

export const UnlockSnackbar: React.FC<UnlockSnackbarProps> = ({
  visible,
  onDismiss,
  appName = 'App',
  balance: propBalance
}) => {
  const { triggerHaptic } = useDeviceIntegration();
  const { balance } = useRewards();
  const { settings, currentSelectionId } = useBlocklist();
  const { requestUnlock } = useBlocklistActions();

  const [selectedDuration, setSelectedDuration] = useState(1);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const currentBalance = propBalance ?? balance;
  const unlockOptions = [1, 5, 15, 30];

  const handleUnlock = async () => {
    if (isUnlocking) return;

    const cost = selectedDuration * settings.unlockCostPerMinute;

    if (currentBalance < cost) {
      triggerHaptic('error');
      Alert.alert(
        'Insufficient Fruits',
        `You need ${cost} fruits to unlock for ${selectedDuration} minute${selectedDuration !== 1 ? 's' : ''}, but only have ${currentBalance} fruits.`,
        [{ text: 'OK' }]
      );
      return;
    }


    setIsUnlocking(true);
    triggerHaptic('light');

    try {
      // Get the current blocked selection from the store
      if (!currentSelectionId) {
        throw new Error('No blocked apps found');
      }

      console.log('🔓 UnlockSnackbar: Temporarily unblocking selection:', currentSelectionId);

      // Use the device activity API to unblock the selection temporarily
      unblockSelection(
        { activitySelectionId: currentSelectionId },
        `temporary-unlock-${Date.now()}`
      );

      // Create a unique activity name for this unlock session
      const activityName = `reblock-${currentSelectionId}`;

      // Calculate when to re-block (current time + unlock duration)
      const now = new Date();
      const reblockTime = new Date(now.getTime() + selectedDuration * 60 * 1000);

      // Calculate start time with 30-minute safety buffer
      const startTime = new Date(reblockTime.getTime() - 30 * 60 * 1000);

      // Create DeviceActivitySchedule for time-based re-blocking
      // This may create cross-midnight intervals for edge cases
      const deviceActivitySchedule = {
        intervalStart: {
          hour: startTime.getHours(),
          minute: startTime.getMinutes(),
          second: 0
        },
        intervalEnd: {
          hour: reblockTime.getHours(),
          minute: reblockTime.getMinutes(),
          second: reblockTime.getSeconds()
        },
        repeats: false, // One-time schedule
      };

      // Configure actions to trigger at interval end (absolute time)
      console.log('🔧 Configuring absolute time reblock actions for:', activityName);
      console.log('⏰ Reblock scheduled from', startTime.toLocaleTimeString(), 'to', reblockTime.toLocaleTimeString());
      configureActions({
        activityName: activityName,
        callbackName: 'intervalDidEnd', // Triggers at absolute time, not usage-based
        actions: [
          {
            type: "blockSelection",
            familyActivitySelectionId: currentSelectionId
          }
        ]
      });
      console.log('✅ Actions configured successfully');

      // Start the actual unlock session tracking first
      const unlockSession = await requestUnlock([], selectedDuration);

      if (unlockSession) {
        // Start Live Activity for countdown display
        const liveActivityId = LiveActivityService.startUnlockCountdown(reblockTime, selectedDuration);

        // Update the unlock session with Live Activity ID if it was started
        if (liveActivityId) {
          unlockSession.liveActivityId = liveActivityId;
          console.log('🎬 Live Activity started for unlock session:', unlockSession.id);
        }

        // Stop any existing monitoring first to avoid "excessive activities" error
        try {
          stopMonitoring([activityName]);
          console.log('✅ Stopped any existing monitoring');
        } catch (error) {
          console.log('ℹ️ No existing monitoring to stop:', error);
        }

        // Schedule monitoring in background (don't await to avoid blocking UI)
        console.log('⏰ Scheduling automatic re-block for:', reblockTime);
        startMonitoring(activityName, deviceActivitySchedule, []).catch(error => {
          console.error('❌ Failed to start monitoring (background):', error);
          // Don't throw error - unlock already succeeded, monitoring is just a backup
        });

        triggerHaptic('success');
        Alert.alert(
          'Apps Unlocked!',
          `Your blocked apps are now unlocked for ${selectedDuration} minute${selectedDuration !== 1 ? 's' : ''}. They will automatically be blocked again at ${reblockTime.toLocaleTimeString()}.`,
          [
            {
              text: 'OK',
              onPress: onDismiss
            }
          ]
        );
        setIsUnlocking(false);
      } else {
        throw new Error('Failed to create unlock session');
      }
    } catch (error) {
      console.error('❌ UnlockSnackbar: Failed to unlock apps:', error);
      triggerHaptic('error');
      Alert.alert(
        'Error',
        'An error occurred while unlocking the apps. Please try again.',
        [{ text: 'OK' }]
      );
      setIsUnlocking(false);
    }
  };

  if (!visible) return null;

  return (
    <View className="absolute bottom-0 left-0 right-0 z-50">
      {/* Dismiss overlay - covers entire screen */}
      <Pressable
        className="absolute inset-0 -top-96"
        onPress={onDismiss}
      />

      {/* Bottom sheet snackbar */}
      <View className="bg-gray-900 rounded-t-3xl mx-4 mb-8 px-6 py-6 border border-gray-700 shadow-2xl">

        {/* Header */}
        <View className="flex-row items-center mb-4">
          <View className="w-12 h-12 bg-red-500 rounded-full items-center justify-center mr-4">
            <Typography variant="subtitle-16" color="white">
              🚫
            </Typography>
          </View>
          <View className="flex-1">
            <Typography variant="subtitle-16" color="white">
              {appName} is blocked
            </Typography>
            <Typography variant="body-12" color="secondary">
              You have {currentBalance} 🍎 available
            </Typography>
          </View>
          <Pressable
            onPress={onDismiss}
            className="p-2 active:opacity-70"
          >
            <Typography variant="subtitle-16" color="secondary">
              ✕
            </Typography>
          </Pressable>
        </View>

        {/* Quick unlock options */}
        <View className="mb-4">
          <Typography variant="body-14" color="secondary" className="mb-3">
            Quick unlock:
          </Typography>
          <View className="flex-row">
            {unlockOptions.slice(0, 4).map(duration => {
              const cost = duration * settings.unlockCostPerMinute;
              const canAfford = currentBalance >= cost;

              return (
                <UnlockOption
                  key={duration}
                  duration={duration}
                  cost={cost}
                  onSelect={() => setSelectedDuration(duration)}
                  disabled={!canAfford}
                  isSelected={selectedDuration === duration}
                />
              );
            })}
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={onDismiss}
            className="flex-1 py-3 rounded-xl border border-gray-600 active:opacity-80"
          >
            <Typography variant="body-14" color="secondary" className="text-center">
              Dismiss
            </Typography>
          </Pressable>

          <Pressable
            onPress={handleUnlock}
            disabled={isUnlocking || currentBalance < (selectedDuration * settings.unlockCostPerMinute)}
            className={`
              flex-1 py-3 rounded-xl active:opacity-80
              ${currentBalance >= (selectedDuration * settings.unlockCostPerMinute)
                ? 'bg-primary'
                : 'bg-gray-600'
              }
            `}
          >
            <Typography variant="body-14" color="white" className="text-center">
              {isUnlocking
                ? 'Unlocking...'
                : `Unlock (${selectedDuration * settings.unlockCostPerMinute} 🍎)`
              }
            </Typography>
          </Pressable>
        </View>

      </View>
    </View>
  );
};