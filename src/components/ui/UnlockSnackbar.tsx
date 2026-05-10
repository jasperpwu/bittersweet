import React, { useEffect, useState } from 'react';
import {
  View,
  Pressable,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Typography } from './Typography';
import { Slider } from './Slider';
import { useBlocklist, useBlocklistActions, useRewards, useAppStore } from '../../store';
import { useDeviceIntegration } from '../../hooks/useDeviceIntegration';
import { unblockSelection, startMonitoring, stopMonitoring, configureActions } from 'react-native-device-activity';
import { LiveActivityService } from '../../services/LiveActivityService';
import { UnlockReasonModal } from '../modals/UnlockReasonModal';
import { showToast } from './Toast';
import * as Notifications from 'expo-notifications';

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

  const { width: screenWidth } = useWindowDimensions();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');

  const currentBalance = propBalance ?? balance;
  const maxFruits = Math.min(currentBalance, 20);
  const maxDuration = Math.max(1, Math.floor(maxFruits / settings.unlockCostPerMinute));
  const lastUnlockDuration = useBlocklist().lastUnlockDuration;
  const initialDuration = lastUnlockDuration ? Math.min(lastUnlockDuration, maxDuration) : 1;
  const [selectedDuration, setSelectedDuration] = useState(initialDuration);

  // Re-clamp if maxDuration shrinks below selectedDuration (e.g., balance changed)
  useEffect(() => {
    if (selectedDuration > maxDuration) {
      setSelectedDuration(maxDuration);
    }
  }, [maxDuration]);
  const sliderWidth = screenWidth - 80; // 40px padding on each side (mx-4 + px-6)

  const handleUnlockClick = () => {
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

    // Show reason modal
    setShowReasonModal(true);
  };

  const handleUnlock = async (reason: string) => {
    if (isUnlocking) return;

    setUnlockReason(reason);
    setShowReasonModal(false);
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
        // Start Live Activity for countdown display with reason
        const liveActivityId = LiveActivityService.startUnlockCountdown(reblockTime, selectedDuration, reason);

        // Persist the Live Activity ID in the store so endUnlock can stop it
        if (liveActivityId) {
          useAppStore.setState((state) => ({
            blocklist: {
              ...state.blocklist,
              activeSessions: {
                ...state.blocklist.activeSessions,
                byId: {
                  ...state.blocklist.activeSessions.byId,
                  [unlockSession.id]: {
                    ...state.blocklist.activeSessions.byId[unlockSession.id],
                    liveActivityId,
                  },
                },
              },
            },
          }));
          console.log('🎬 Live Activity started for unlock session:', unlockSession.id);
        }

        // Schedule a local notification at unlock expiry. When it fires,
        // iOS wakes the app and the notification listener in _layout.tsx
        // dismisses the live activity immediately.
        const secondsUntilExpiry = Math.max(1, Math.round((reblockTime.getTime() - Date.now()) / 1000));
        Notifications.scheduleNotificationAsync({
          content: {
            title: 'Unlock Expired',
            body: `Your ${selectedDuration}m unlock has ended. Apps are blocked again.`,
            sound: true,
            data: {
              type: 'unlock-expired',
              liveActivityId,
              unlockSessionId: unlockSession.id,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsUntilExpiry,
          },
        }).then(notificationId => {
          const session = useAppStore.getState().blocklist.activeSessions.byId[unlockSession.id];
          if (!session?.isActive) {
            Notifications.cancelScheduledNotificationAsync(notificationId).catch((error) => {
              console.error('Failed to cancel inactive unlock notification:', error);
            });
            return;
          }

          useAppStore.setState((state) => ({
            blocklist: {
              ...state.blocklist,
              activeSessions: {
                ...state.blocklist.activeSessions,
                byId: {
                  ...state.blocklist.activeSessions.byId,
                  [unlockSession.id]: {
                    ...state.blocklist.activeSessions.byId[unlockSession.id],
                    notificationId,
                  },
                },
              },
            },
          }));
        }).catch(error => {
          console.error('Failed to schedule unlock expiration notification:', error);
        });

        // Also schedule JS dismissal for when the app is in foreground
        const msUntilExpiry = reblockTime.getTime() - Date.now();
        setTimeout(() => {
          const session = useAppStore.getState().blocklist.activeSessions.byId[unlockSession.id];
          if (!session?.isActive) return;

          console.log('⏰ Unlock expired — dismissing Live Activity:', liveActivityId);
          if (liveActivityId) {
            LiveActivityService.stopUnlockCountdown(liveActivityId, 'expired');
          }
          useAppStore.getState().blocklist.endUnlock(unlockSession.id);
        }, msUntilExpiry);

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
        setIsUnlocking(false);
        onDismiss();
        showToast(`Unlocked for ${selectedDuration}m`, 'success');
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

        {/* Unlock duration slider */}
        <View className="mb-4">
          <Slider
            value={selectedDuration}
            minimumValue={1}
            maximumValue={maxDuration}
            step={1}
            onValueChange={setSelectedDuration}
            label="Unlock for"
            unit="m"
            width={sliderWidth}
            thumbSize={26}
          />
          <View className="items-center mt-1">
            <Typography variant="body-12" color="primary">
              Cost: {selectedDuration * settings.unlockCostPerMinute} 🍎
            </Typography>
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
            onPress={handleUnlockClick}
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

      {/* Unlock Reason Modal */}
      <UnlockReasonModal
        visible={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        onConfirm={handleUnlock}
        onCancel={() => setShowReasonModal(false)}
      />
    </View>
  );
};
