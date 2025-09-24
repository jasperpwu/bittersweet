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
import { useShieldDeepLinkMonitor } from '../src/hooks/useShieldDeepLinkMonitor';
import { useShieldNotificationHandler } from '../src/hooks/useShieldNotificationHandler';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const { fontsLoaded } = useFonts();
  const { isHydrated, initializeApp } = useAppState();

  // Initialize Device Activity Listener
  const { isListening } = useDeviceActivityListener();

  // Initialize Shield Deep Link Monitor
  const { manualCheck } = useShieldDeepLinkMonitor();

  // Initialize Shield Notification Handler
  const { checkLastNotificationResponse } = useShieldNotificationHandler();

  // Initialize stores
  useEffect(() => {
    initializeUnifiedStore();
    autoInitializeMockData(); // Initialize main store with mock data

    // Debug: Clear storage if needed (change to true if needed)
    if (__DEV__ && false) {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        AsyncStorage.clear().then(() => {
          console.log('🧹 Debug: Storage cleared for fresh start');
        });
      });
    }
  }, []);

  // Handle URL scheme for shield unlocks
  useEffect(() => {
    const handleURL = (event: { url: string }) => {
      console.log('📱 [DEEPLINK] URL received:', event.url);
      console.log('📱 [DEEPLINK] URL type:', typeof event.url);
      console.log('📱 [DEEPLINK] URL includes unlock:', event.url.includes('unlock'));

      if (event.url.includes('unlock')) {
        console.log('✅ [DEEPLINK] URL contains unlock, processing via FamilyControlsModule...');

        // Use the centralized deep link processing
        import('../src/modules/BitterSweetFamilyControls').then(({ FamilyControlsModule }) => {
          FamilyControlsModule.processPendingDeepLink(event.url);
        });
      } else {
        console.log('ℹ️ [DEEPLINK] URL does not contain unlock keyword');
      }
    };

    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleURL({ url: initialUrl });
      }
    };

    // Handle app opened from URL while running
    const subscription = Linking.addEventListener('url', handleURL);

    // Handle app opened from URL when not running
    handleInitialURL();

    return () => {
      subscription?.remove();
    };
  }, []);

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
                name="(modals)/blocklist-settings"
                options={{
                  headerShown: false,
                  presentation: 'modal',
                  gestureEnabled: true,
                }}
              />
              <Stack.Screen
                name="(modals)/blocking-screen"
                options={{
                  headerShown: false,
                  presentation: 'fullScreenModal',
                  gestureEnabled: false,
                }}
              />
            </Stack>
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
