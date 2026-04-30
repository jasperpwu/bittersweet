import 'react-native-gesture-handler';
import '../global.css';

import { Stack } from 'expo-router';
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
import { router } from 'expo-router';
import { AppState, AppStateStatus } from 'react-native';
import { UnlockSnackbar } from '../src/components/ui/UnlockSnackbar';
import { LiveActivityService } from '../src/services/LiveActivityService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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



  // Initialize stores and global error handling
  useEffect(() => {
    initializeUnifiedStore();
    autoInitializeMockData(); // Initialize main store with mock data

    // Request notification permissions for focus timer completion sound
    Notifications.requestPermissionsAsync();

    // Vibrate on foreground notification if vibration is enabled
    const notificationSubscription = Notifications.addNotificationReceivedListener(() => {
      const { useUnifiedStore } = require('../src/store/unified-store');
      const vibrationEnabled = useUnifiedStore.getState().preferences.notifications.vibration;
      if (vibrationEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });

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

        // End any lingering live activities. JS timers are suspended in the
        // background, so if a focus session's timer expired while the phone was
        // locked, stopActivity was never called. This is the safety net.
        LiveActivityService.cleanupExpired();
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => subscription?.remove();
  }, [fontsLoaded, isHydrated]);

  // Deep link handling removed - now using UserDefaults + foreground detection only

  // Debug logging
  if (__DEV__) {
    console.log('RootLayout - fontsLoaded:', fontsLoaded);
    console.log('RootLayout - isHydrated:', isHydrated);
  }

  const isReady = fontsLoaded && isHydrated;

  return (
    <ErrorBoundary>
      <AnimatedSplashScreen>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {isReady ? (
            <>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="(modals)/session-creation"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                    gestureEnabled: true,
                  }}
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
            </>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1B1C30' }}>
              <Text style={{ color: '#FFFFFF' }}>Loading...</Text>
            </View>
          )}
        </GestureHandlerRootView>
      </AnimatedSplashScreen>
    </ErrorBoundary>
  );
}
