import '../global.css';

import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from '../src/hooks/useFonts';
import { View, Text } from 'react-native';
import { AnimatedSplashScreen } from '../src/components/ui/AnimatedSplashScreen';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const { fontsLoaded } = useFonts();

  return (
    <AnimatedSplashScreen>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {fontsLoaded ? (
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen 
              name="(modals)/task-creation" 
              options={{ 
                headerShown: false,
                presentation: 'modal',
                gestureEnabled: true,
              }} 
            />
          </Stack>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f1f1' }}>
            <Text>Loading...</Text>
          </View>
        )}
      </GestureHandlerRootView>
    </AnimatedSplashScreen>
  );
}
