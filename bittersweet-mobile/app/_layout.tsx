import '../global.css';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from '../src/hooks/useFonts';
import { View, Text } from 'react-native';
import { AnimatedSplashScreen } from '../src/components/ui/AnimatedSplashScreen';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import { useAppState, initializeUnifiedStore } from '../src/store/unified-store';
import { autoInitializeMockData } from '../src/store/initializeMockData';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const { fontsLoaded } = useFonts();
  const { isHydrated, initializeApp } = useAppState();

  // Initialize stores
  useEffect(() => {
    initializeUnifiedStore();
    autoInitializeMockData(); // Initialize main store with mock data
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
                name="(modals)/category-selection" 
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
