import 'react-native-gesture-handler';
import '../global.css';

import { Stack, router, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from '../src/hooks/useFonts';
import { View, Text } from 'react-native';
import { AnimatedSplashScreen } from '../src/components/ui/AnimatedSplashScreen';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import { useAppState, initializeUnifiedStore } from '../src/store/unified-store';
import { autoInitializeMockData } from '../src/store/initializeMockData';
import { useDeviceActivityListener } from '../src/hooks/useDeviceActivityListener';
import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { AppState, AppStateStatus } from 'react-native';
import { UnlockSnackbar } from '../src/components/ui/UnlockSnackbar';
import { Toast } from '../src/components/ui/Toast';
import { LiveActivityService } from '../src/services/LiveActivityService';
import { WidgetService } from '../src/services/WidgetService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../src/store';

// Show notification banner even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => {
    const { useUnifiedStore } = await import('../src/store/unified-store');
    const soundEnabled = useUnifiedStore.getState().preferences.notifications.sound;
    return {
      shouldShowBanner: true,
      shouldShowList: false,
      shouldPlaySound: soundEnabled,
      shouldSetBadge: false,
    };
  },
});

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const { fontsLoaded } = useFonts();
  const { isHydrated, initializeApp } = useAppState();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [showUnlockSheet, setShowUnlockSheet] = useState(false);

  // Initialize Device Activity Listener
  const { isListening } = useDeviceActivityListener();

  const checkExpiredUnlockSessions = (trigger: string) => {
    try {
      console.log(`⏰ Checking expired unlock sessions (${trigger})`);
      useAppStore.getState().blocklist.checkActiveUnlocks();
    } catch (error) {
      console.error('❌ Failed to check expired unlock sessions:', error);
    }
  };

  const syncShieldConfiguration = async (trigger: string) => {
    try {
      const store = useAppStore.getState();
      const currentSelectionId = store.blocklist.currentSelectionId;
      if (!currentSelectionId) {
        return;
      }

      console.log(`🛡️ Syncing shield configuration (${trigger})`);
      const { FamilyControlsModule } = await import('../src/modules/BitterSweetFamilyControls');
      await FamilyControlsModule.updateShieldBalance(store.rewards.balance);
    } catch (error) {
      console.error('❌ Failed to sync shield configuration:', error);
    }
  };

  // Initialize stores and global error handling
  useEffect(() => {
    initializeUnifiedStore();
    autoInitializeMockData(); // Initialize main store with mock data

    // Request notification permissions for focus timer completion sound
    Notifications.requestPermissionsAsync();

    // Handle incoming notifications (vibration + unlock expiry dismissal)
    const notificationSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { useUnifiedStore } = require('../src/store/unified-store');
        const vibrationEnabled = useUnifiedStore.getState().preferences.notifications.vibration;
        if (vibrationEnabled) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Dismiss the live activity when the unlock session expires
        const data = notification.request.content.data;
        if (data?.type === 'unlock-expired') {
          if (data.unlockSessionId) {
            useAppStore.getState().blocklist.endUnlock(data.unlockSessionId as string);
          } else if (data.liveActivityId) {
            LiveActivityService.stopUnlockCountdown(data.liveActivityId as string, 'expired');
          }
        }
      }
    );

    // Debug: Clear storage if needed (change to true if needed)
    if (__DEV__ && false) {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        AsyncStorage.clear().then(() => {
          console.log('🧹 Debug: Storage cleared for fresh start');
        });
      });
    }

    return () => {
      notificationSubscription.remove();
    };
  }, []);

  const syncWidgetTagList = () => {
    try {
      const store = useAppStore.getState();
      const { tags, lastDurationByTagId } = store.focus;
      const tagList = tags.allIds.map(id => {
        const tag = tags.byId[id];
        return {
          id: tag.id,
          name: tag.name,
          icon: tag.icon || '🎯',
          color: tag.color || '#8B4513',
          lastDuration: lastDurationByTagId[id] ?? 15,
        };
      });
      WidgetService.syncTagList(tagList);
    } catch (error) {
      console.error('📱 [Widget] Failed to sync tag list:', error);
    }
  };

  const adoptWidgetSession = async () => {
    try {
      // Check if widget stopped a session
      const stopAction = WidgetService.checkWidgetStopAction();
      if (stopAction) {
        console.log('📱 [Widget] Adopting widget stop action');

        // Try to find session info from AsyncStorage first (app was opened during session),
        // then fall back to widgetStartedSession (user never opened the app)
        const activeRaw = await AsyncStorage.getItem('active-focus-session');
        const widgetSession = WidgetService.checkWidgetStartedSession();
        const sessionInfo = activeRaw
          ? JSON.parse(activeRaw)
          : widgetSession
            ? { startTime: widgetSession.startTime, targetDuration: widgetSession.duration, tagId: widgetSession.tagId }
            : null;

        if (sessionInfo) {
          const store = useAppStore.getState();
          const actualEndTime = stopAction.timestamp;
          const durationMs = actualEndTime - sessionInfo.startTime;
          const durationMinutes = Math.round(durationMs / 60000);

          if (durationMinutes > 0) {
            store.focus.createCompletedSession({
              startTime: new Date(sessionInfo.startTime),
              endTime: new Date(actualEndTime),
              duration: durationMinutes,
              targetDuration: sessionInfo.targetDuration,
              tagId: sessionInfo.tagId,
            });
            console.log('📱 [Widget] Recorded completed session:', durationMinutes, 'min');
          }

          await AsyncStorage.removeItem('active-focus-session');
          // Sync widget to idle
          WidgetService.syncSessionState(null);
        }
      }

      // Check if widget started a session
      const startedSession = WidgetService.checkWidgetStartedSession();
      if (startedSession) {
        console.log('📱 [Widget] Adopting widget-started session:', startedSession.tagId);

        // Skip if there's already an active session in AsyncStorage
        const existingSession = await AsyncStorage.getItem('active-focus-session');
        if (existingSession) {
          console.log('📱 [Widget] Existing active session found, skipping adoption');
          return;
        }

        // Skip expired timed sessions
        if (!startedSession.isInfinite && startedSession.endTime > 0 && Date.now() > startedSession.endTime) {
          console.log('📱 [Widget] Widget-started session already expired, skipping');
          // Clear widget display since session is over
          WidgetService.syncSessionState(null);
          return;
        }

        // The Live Activity was already started by the LiveActivityIntent in the
        // app process. Adopt it so JS can manage (stop) it later.
        if (startedSession.liveActivityId) {
          LiveActivityService.adoptWidgetActivity(
            startedSession.liveActivityId,
            startedSession.isInfinite ? undefined : startedSession.endTime
          );
        }

        // Write PersistedSession to AsyncStorage so index.tsx recovery code picks it up
        const persistedSession = {
          startTime: startedSession.startTime,
          endTime: startedSession.isInfinite ? 0 : startedSession.endTime,
          targetDuration: startedSession.duration,
          tagId: startedSession.tagId,
          isInfinite: startedSession.isInfinite,
          liveActivityId: startedSession.liveActivityId,
        };
        await AsyncStorage.setItem('active-focus-session', JSON.stringify(persistedSession));
        console.log('📱 [Widget] Wrote active-focus-session for recovery, liveActivityId:', startedSession.liveActivityId);
      }
    } catch (error) {
      console.error('📱 [Widget] Failed to adopt widget session:', error);
    }
  };

  useEffect(() => {
    if (isHydrated) {
      checkExpiredUnlockSessions('mount');
      syncShieldConfiguration('mount');
      syncWidgetTagList();

      // Adopt any widget-started/stopped session (cold start)
      adoptWidgetSession();
    }
  }, [isHydrated]);

  // Check if app was opened from shield (both on mount and app foreground)
  const checkShieldOpening = async (trigger: string) => {
    try {
      console.log(`🛡️ [SHIELD_LAYOUT] === Starting shield check (${trigger}) ===`);
      console.log('🛡️ [SHIELD_LAYOUT] fontsLoaded:', fontsLoaded, 'isHydrated:', isHydrated);

      if (!fontsLoaded || !isHydrated) {
        console.log('🛡️ [SHIELD_LAYOUT] App not ready, skipping shield check');
        return;
      }

      const { FamilyControlsModule } = await import('../src/modules/BitterSweetFamilyControls');
      console.log('🛡️ [SHIELD_LAYOUT] FamilyControlsModule imported successfully');

      const wasOpenedFromShield = await FamilyControlsModule.checkIfOpenedFromShield();
      console.log('🛡️ [SHIELD_LAYOUT] checkIfOpenedFromShield result:', wasOpenedFromShield);

      if (wasOpenedFromShield) {
        // Don't show unlock sheet during a focus session
        const activeSession = await AsyncStorage.getItem('active-focus-session');
        if (activeSession) {
          console.log('🛡️ [SHIELD_LAYOUT] Focus session active, skipping unlock sheet');
          return;
        }

        console.log('✅ [SHIELD_LAYOUT] App was opened from shield, showing bottom sheet...');

        // Navigate to calendar tab and show bottom sheet
        router.replace('/(tabs)');

        // Small delay then show the bottom sheet overlay
        setTimeout(() => {
          console.log('🛡️ [SHIELD_LAYOUT] Showing unlock bottom sheet...');
          setShowUnlockSheet(true);
        }, 100);

        console.log('✅ [SHIELD_LAYOUT] Bottom sheet sequence initiated');
      } else {
        console.log('ℹ️ [SHIELD_LAYOUT] App was not opened from shield');
      }
    } catch (error: any) {
      console.error('❌ [SHIELD_LAYOUT] Error checking shield opening:', error);
      console.error('❌ [SHIELD_LAYOUT] Error stack:', error?.stack);
    }
  };

  // Check on app mount
  useEffect(() => {
    checkShieldOpening('mount');
  }, [fontsLoaded, isHydrated]);

  // Check when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      console.log('🛡️ [SHIELD_LAYOUT] App state change:', appState.current, '->', nextAppState);

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('🛡️ [SHIELD_LAYOUT] App came to foreground - checking for shield opening...');
        checkShieldOpening('foreground');

        // Adopt any widget-started/stopped session (warm start)
        adoptWidgetSession();

        // End any lingering live activities. JS timers are suspended in the
        // background, so if a focus session's timer expired while the phone was
        // locked, stopActivity was never called. This is the safety net.
        LiveActivityService.cleanupExpired();
        checkExpiredUnlockSessions('foreground');
        syncShieldConfiguration('foreground');
        syncWidgetTagList();
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => subscription?.remove();
  }, [fontsLoaded, isHydrated]);

  // Debug logging
  if (__DEV__) {
    console.log('RootLayout - fontsLoaded:', fontsLoaded);
    console.log('RootLayout - isHydrated:', isHydrated);
  }

  const isReady = fontsLoaded && isHydrated;
  const pathname = usePathname();

  useEffect(() => {
    if (isReady) {
      const { useUnifiedStore } = require('../src/store/unified-store');
      const hasSeenOnboarding = useUnifiedStore.getState().preferences?.hasSeenOnboarding;

      if (!hasSeenOnboarding && pathname !== '/onboarding') {
        // Small delay to ensure router is ready
        setTimeout(() => {
          router.replace('/onboarding');
        }, 50);
      }
    }
  }, [isReady, pathname]);

  return (
    <ErrorBoundary>
      <AnimatedSplashScreen>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {isReady ? (
            <>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="onboarding"
                  options={{ headerShown: false, gestureEnabled: false }}
                />
                <Stack.Screen
                  name="(modals)/session-complete"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/dev-tools"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                    gestureEnabled: true,
                  }}
                />
              </Stack>

              {/* Unlock bottom sheet overlay */}
              <UnlockSnackbar
                visible={showUnlockSheet}
                onDismiss={() => {
                  console.log('🛡️ [SHIELD_LAYOUT] Bottom sheet dismissed');
                  setShowUnlockSheet(false);
                }}
                appName="App" // You can make this dynamic later
              />

              {/* Unlock/lock toast notification */}
              <Toast />
            </>
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#1B1C30',
              }}>
              <Text style={{ color: '#FFFFFF' }}>Loading...</Text>
            </View>
          )}
        </GestureHandlerRootView>
      </AnimatedSplashScreen>
    </ErrorBoundary>
  );
}
