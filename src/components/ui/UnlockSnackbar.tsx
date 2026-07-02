import React, { useEffect, useState } from 'react';
import {
  View,
  Pressable,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from './Typography';
import { Slider } from './Slider';
import { UnlockTrendChart } from './UnlockTrendChart';
import { useBlocklist, useBlocklistActions, useRewards, useAppStore } from '../../store';
import { useDeviceIntegration } from '../../hooks/useDeviceIntegration';
import { unblockSelection, startMonitoring, stopMonitoring, configureActions } from 'react-native-device-activity';
import { LiveActivityService } from '../../services/LiveActivityService';
import { WidgetService } from '../../services/WidgetService';
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
  const { t } = useTranslation();
  const { triggerHaptic } = useDeviceIntegration();
  const { balance, unlockHistory } = useRewards();
  const { settings, currentSelectionId } = useBlocklist();
  const { requestUnlock } = useBlocklistActions();

  const { width: screenWidth } = useWindowDimensions();
  const [isUnlocking, setIsUnlocking] = useState(false);

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

  const handleUnlock = async () => {
    if (isUnlocking) return;

    const cost = selectedDuration * settings.unlockCostPerMinute;

    if (currentBalance < cost) {
      triggerHaptic('error');
      Alert.alert(
        t('unlock.insufficientTitle'),
        t('unlock.insufficientBody', { cost, minutes: selectedDuration, balance: currentBalance }),
        [{ text: t('common.ok') }]
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
        // Start Live Activity for countdown display with reason
        const liveActivityId = await LiveActivityService.startUnlockCountdown(reblockTime, selectedDuration);

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

        // Sync unlock state to home screen widget
        WidgetService.syncUnlockSessionState({
          isActive: true,
          endTime: reblockTime.getTime(),
        });

        // Schedule a local notification at unlock expiry. When it fires,
        // iOS wakes the app and the notification listener in _layout.tsx
        // dismisses the live activity immediately.
        const secondsUntilExpiry = Math.max(1, Math.round((reblockTime.getTime() - Date.now()) / 1000));
        Notifications.scheduleNotificationAsync({
          content: {
            title: t('unlock.expiredTitle'),
            body: t('unlock.expiredBody', { minutes: selectedDuration }),
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

          // Expose the notification ID to native via shared UserDefaults so the
          // native StopUnlockIntent can cancel it when the user ends the unlock
          // from the Live Activity (banner/Dynamic Island) while the app is
          // backgrounded. Without this, the stale "Unblock Expired" notification
          // still fires and its handler ends the session as 'expired' — skipping
          // the fruit refund. Mirrors the focus-session pattern (StopSessionIntent).
          WidgetService.syncScheduledNotificationId(notificationId);

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

        // Also schedule JS dismissal for when the app is in foreground. Route
        // through checkActiveUnlocks (not endUnlock directly) so that if the
        // unlock was ended early from the Live Activity, the native stop marker
        // is honored and the unused time is still refunded — endUnlock stops the
        // Live Activity itself.
        const msUntilExpiry = reblockTime.getTime() - Date.now();
        setTimeout(() => {
          const session = useAppStore.getState().blocklist.activeSessions.byId[unlockSession.id];
          if (!session?.isActive) return;
          useAppStore.getState().blocklist.checkActiveUnlocks();
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
        showToast(t('unlock.unlockedToast', { minutes: selectedDuration }), 'success');
      } else {
        throw new Error('Failed to create unlock session');
      }
    } catch (error) {
      console.error('❌ UnlockSnackbar: Failed to unlock apps:', error);
      triggerHaptic('error');
      Alert.alert(
        t('common.error'),
        t('unlock.errorBody'),
        [{ text: t('common.ok') }]
      );
      setIsUnlocking(false);
    }
  };

  if (!visible) return null;

  return (
    <View className="absolute inset-0 z-50 justify-end">
      {/* Dimmed dismiss overlay - covers entire screen behind the sheet */}
      <Pressable
        className="absolute inset-0 bg-black/70"
        onPress={onDismiss}
      />

      {/* Bottom sheet snackbar */}
      <View className="bg-light-bg dark:bg-gray-900 rounded-t-3xl mx-4 mb-8 px-6 py-6 border border-light-border dark:border-gray-700 shadow-2xl">

        {/* Header */}
        <View className="flex-row items-center mb-4">
          <View className="w-12 h-12 bg-red-500 rounded-full items-center justify-center mr-4">
            <Typography variant="subtitle-16" color="white">
              🚫
            </Typography>
          </View>
          <View className="flex-1">
            <Typography variant="subtitle-16" color="primary">
              {t('unlock.appBlocked', { app: appName })}
            </Typography>
            <Typography variant="body-12" color="secondary">
              {t('unlock.available', { amount: currentBalance })}
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

        {/* Unlock time trend — today's bar grows with the slider below */}
        <View className="mb-4">
          <UnlockTrendChart
            history={unlockHistory ?? {}}
            previewMinutes={selectedDuration}
          />
        </View>

        {/* Unlock duration slider */}
        <View className="mb-4">
          <Slider
            value={selectedDuration}
            minimumValue={1}
            maximumValue={maxDuration}
            step={1}
            onValueChange={setSelectedDuration}
            label={t('unlock.unlockFor')}
            unit="m"
            width={sliderWidth}
            thumbSize={26}
          />
          <View className="items-center mt-1">
            <Typography variant="body-12" color="primary">
              {t('unlock.cost', { amount: selectedDuration * settings.unlockCostPerMinute })}
            </Typography>
          </View>
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={onDismiss}
            className="flex-1 py-3 rounded-xl border border-light-border dark:border-gray-600 active:opacity-80"
          >
            <Typography variant="body-14" color="secondary" className="text-center">
              {t('unlock.dismiss')}
            </Typography>
          </Pressable>

          <Pressable
            onPress={handleUnlock}
            disabled={isUnlocking || currentBalance < (selectedDuration * settings.unlockCostPerMinute)}
            className={`
              flex-1 py-3 rounded-xl active:opacity-80
              ${currentBalance >= (selectedDuration * settings.unlockCostPerMinute)
                ? 'bg-primary'
                : 'bg-light-border dark:bg-gray-600'
              }
            `}
          >
            <Typography variant="body-14" color="white" className="text-center">
              {isUnlocking
                ? t('unlock.unlocking')
                : t('unlock.unlockCta', { amount: selectedDuration * settings.unlockCostPerMinute })
              }
            </Typography>
          </Pressable>
        </View>

      </View>
    </View>
  );
};
