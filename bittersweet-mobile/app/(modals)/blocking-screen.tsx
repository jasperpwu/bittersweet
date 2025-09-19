import React, { useState, useEffect } from 'react';
import {
  View,
  SafeAreaView,
  Pressable,
  Alert,
  AppState,
  Animated
} from 'react-native';
import { Typography } from '../../src/components/ui/Typography';
import { useBlocklist, useBlocklistActions, useRewards } from '../../src/store';
import { useDeviceIntegration } from '../../src/hooks/useDeviceIntegration';
import { router, useLocalSearchParams } from 'expo-router';

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
        p-4 rounded-xl border-2 mb-3 active:opacity-80
        ${isSelected
          ? 'border-primary bg-primary/10'
          : 'border-dark-border bg-dark-surface'
        }
        ${disabled ? 'opacity-50' : ''}
      `}
    >
      <View className="flex-row items-center justify-between">
        <View>
          <Typography variant="subtitle-16" color="white">
            {duration} minute{duration !== 1 ? 's' : ''}
          </Typography>
          <Typography variant="body-12" color="secondary">
            Unlock for {duration} minute{duration !== 1 ? 's' : ''}
          </Typography>
        </View>
        <View className="items-end">
          <Typography variant="subtitle-16" color="primary">
            {cost} 🍎
          </Typography>
          <Typography variant="body-12" color="secondary">
            {cost === 1 ? '1 fruit' : `${cost} fruits`}
          </Typography>
        </View>
      </View>
    </Pressable>
  );
};

interface CountdownTimerProps {
  remainingSeconds: number;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ remainingSeconds }) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <View className="items-center">
      <Typography variant="headline-24" color="primary" className="mb-1">
        {minutes}:{seconds.toString().padStart(2, '0')}
      </Typography>
      <Typography variant="body-12" color="secondary">
        Remaining unlock time
      </Typography>
    </View>
  );
};

export default function BlockingScreen() {
  const { triggerHaptic } = useDeviceIntegration();
  const { balance } = useRewards();
  const {
    settings,
    activeSessions,
    getRemainingUnlocks
  } = useBlocklist();
  const { requestUnlock, endUnlock } = useBlocklistActions();

  // Get app info from search params (passed by native module)
  const params = useLocalSearchParams();
  const appName = params.appName as string || 'Unknown App';
  const appBundleId = params.appBundleId as string || '';
  const appTokens = params.appTokens ? JSON.parse(params.appTokens as string) : [];

  const [selectedDuration, setSelectedDuration] = useState(1);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [remainingTime, setRemainingTime] = useState(0);

  // Animation for the blocked state
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    // Check if there's already an active session for this app
    const existingSession = Object.values(activeSessions.byId).find(
      session => session.isActive &&
      session.appTokens.some(token => token.bundleIdentifier === appBundleId)
    );

    if (existingSession) {
      setActiveSession(existingSession);
      setRemainingTime(existingSession.remainingTime || 0);
    }

    // Start pulse animation for blocked state
    if (!existingSession) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [activeSessions]);

  useEffect(() => {
    // Countdown timer for active unlock session
    if (activeSession && remainingTime > 0) {
      const timer = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1) {
            // Session expired
            setActiveSession(null);
            triggerHaptic('error');
            Alert.alert(
              'Session Expired',
              'Your unlock time has ended. The app is now blocked again.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [activeSession, remainingTime]);

  const handleUnlock = async () => {
    if (isUnlocking) return;

    const cost = selectedDuration * settings.unlockCostPerMinute;
    const remainingUnlocks = getRemainingUnlocks();

    // Validation checks
    if (balance < cost) {
      triggerHaptic('error');
      Alert.alert(
        'Insufficient Fruits',
        `You need ${cost} fruits to unlock for ${selectedDuration} minute${selectedDuration !== 1 ? 's' : ''}, but only have ${balance} fruits.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (remainingUnlocks <= 0) {
      triggerHaptic('error');
      Alert.alert(
        'Daily Limit Reached',
        'You have reached your daily unlock limit. Try again tomorrow.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsUnlocking(true);
    triggerHaptic('light');

    try {
      const session = await requestUnlock(appTokens, selectedDuration);

      if (session) {
        setActiveSession(session);
        setRemainingTime(session.remainingTime || selectedDuration * 60);

        triggerHaptic('success');
        Alert.alert(
          'App Unlocked!',
          `${appName} is now unlocked for ${selectedDuration} minute${selectedDuration !== 1 ? 's' : ''}. You can now use the app.`,
          [
            {
              text: 'Use App',
              onPress: () => {
                // Close the blocking screen so user can access the app
                router.back();
              }
            }
          ]
        );
      } else {
        triggerHaptic('error');
        Alert.alert(
          'Unlock Failed',
          'Failed to unlock the app. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      triggerHaptic('error');
      Alert.alert(
        'Error',
        'An error occurred while unlocking the app.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleEndSession = () => {
    if (activeSession) {
      Alert.alert(
        'End Session?',
        'Are you sure you want to end your unlock session early? The app will be blocked again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Session',
            style: 'destructive',
            onPress: () => {
              endUnlock(activeSession.id);
              setActiveSession(null);
              setRemainingTime(0);
              triggerHaptic('light');
            }
          }
        ]
      );
    }
  };

  const unlockOptions = [1, 5, 15, 30].filter(duration =>
    duration <= settings.maxUnlockDuration
  );

  const remainingUnlocks = getRemainingUnlocks();

  // If there's an active session, show the unlocked state
  if (activeSession && remainingTime > 0) {
    return (
      <SafeAreaView className="flex-1 bg-green-900">
        <View className="flex-1 justify-center items-center px-6">
          {/* Success Icon */}
          <View className="w-24 h-24 bg-green-500 rounded-full items-center justify-center mb-6">
            <Typography variant="headline-32" color="white">
              ✓
            </Typography>
          </View>

          {/* App Info */}
          <Typography variant="headline-24" color="white" className="text-center mb-2">
            {appName} Unlocked
          </Typography>
          <Typography variant="body-14" color="green-100" className="text-center mb-8">
            You can now use this app
          </Typography>

          {/* Countdown Timer */}
          <View className="bg-green-800/50 p-6 rounded-xl mb-8">
            <CountdownTimer remainingSeconds={remainingTime} />
          </View>

          {/* Action Buttons */}
          <View className="w-full max-w-sm">
            <Pressable
              onPress={() => router.back()}
              className="bg-green-600 py-4 rounded-xl mb-3 active:opacity-80"
            >
              <Typography variant="subtitle-16" color="white" className="text-center">
                Use App Now
              </Typography>
            </Pressable>

            <Pressable
              onPress={handleEndSession}
              className="border border-green-400 py-4 rounded-xl active:opacity-80"
            >
              <Typography variant="body-14" color="green-100" className="text-center">
                End Session Early
              </Typography>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Show blocked state
  return (
    <SafeAreaView className="flex-1 bg-red-900">
      <View className="flex-1 justify-center items-center px-6">
        {/* Blocked Icon */}
        <Animated.View
          style={{ transform: [{ scale: pulseAnim }] }}
          className="w-24 h-24 bg-red-500 rounded-full items-center justify-center mb-6"
        >
          <Typography variant="headline-32" color="white">
            🚫
          </Typography>
        </Animated.View>

        {/* App Info */}
        <Typography variant="headline-24" color="white" className="text-center mb-2">
          {appName} is Blocked
        </Typography>
        <Typography variant="body-14" color="red-100" className="text-center mb-2">
          This app is currently blocked to help you focus
        </Typography>

        {/* Fruits Available */}
        <View className="bg-red-800/50 p-4 rounded-xl mb-8">
          <Typography variant="subtitle-16" color="white" className="text-center">
            You have {balance} 🍎
          </Typography>
          <Typography variant="body-12" color="red-100" className="text-center mt-1">
            Earn more by completing focus sessions
          </Typography>
        </View>

        {/* Unlock Options */}
        <View className="w-full max-w-sm mb-6">
          <Typography variant="subtitle-16" color="white" className="mb-4 text-center">
            Unlock Temporarily
          </Typography>

          {unlockOptions.map(duration => {
            const cost = duration * settings.unlockCostPerMinute;
            const canAfford = balance >= cost;

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

        {/* Unlock Button */}
        <View className="w-full max-w-sm">
          {remainingUnlocks > 0 ? (
            <Pressable
              onPress={handleUnlock}
              disabled={isUnlocking || balance < (selectedDuration * settings.unlockCostPerMinute)}
              className={`
                py-4 rounded-xl mb-3 active:opacity-80
                ${balance >= (selectedDuration * settings.unlockCostPerMinute)
                  ? 'bg-primary'
                  : 'bg-gray-600'
                }
              `}
            >
              <Typography variant="subtitle-16" color="white" className="text-center">
                {isUnlocking
                  ? 'Unlocking...'
                  : `Unlock for ${selectedDuration * settings.unlockCostPerMinute} 🍎`
                }
              </Typography>
            </Pressable>
          ) : (
            <View className="bg-gray-700 py-4 rounded-xl mb-3">
              <Typography variant="subtitle-16" color="gray-300" className="text-center">
                Daily Unlock Limit Reached
              </Typography>
            </View>
          )}

          <View className="bg-red-800/30 p-3 rounded-lg">
            <Typography variant="body-12" color="red-100" className="text-center">
              {remainingUnlocks > 0
                ? `${remainingUnlocks} unlock${remainingUnlocks !== 1 ? 's' : ''} remaining today`
                : 'No more unlocks available today'
              }
            </Typography>
          </View>

          {/* Close Button */}
          <Pressable
            onPress={() => router.back()}
            className="mt-6 py-3 active:opacity-70"
          >
            <Typography variant="body-14" color="red-200" className="text-center">
              Go Back
            </Typography>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}