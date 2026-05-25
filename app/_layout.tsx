import 'react-native-gesture-handler';
import '../global.css';

import { Stack, router, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from '../src/hooks/useFonts';
import { View, Text, useColorScheme } from 'react-native';
import { StatusBar } from '../src/components/ui/StatusBar';
import { AnimatedSplashScreen } from '../src/components/ui/AnimatedSplashScreen';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import { useAppState, initializeUnifiedStore } from '../src/store/unified-store';
import { autoInitializeMockData } from '../src/store/initializeMockData';
import { useDeviceActivityListener } from '../src/hooks/useDeviceActivityListener';
import { useGoalNudgeNotifications } from '../src/hooks/useGoalNudgeNotifications';
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
import { supabase } from '../src/config/supabase';
import { initSyncMiddleware, resetSyncSnapshot } from '../src/store/middleware/syncMiddleware';

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
  const mainStoreHydrated = useAppStore((s) => s.ui.isHydrated);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [showUnlockSheet, setShowUnlockSheet] = useState(false);

  // Initialize Device Activity Listener
  const { isListening } = useDeviceActivityListener();

  // Schedule/cancel goal nudge notifications
  useGoalNudgeNotifications();

  const checkExpiredUnlockSessions = (trigger: string) => {
    try {
      console.log(`⏰ Checking expired unlock sessions (${trigger})`);
      useAppStore.getState().blocklist.checkActiveUnlocks();

      // If no more active unlocks, clear the widget unlock state
      const { activeSessions } = useAppStore.getState().blocklist;
      const hasActiveUnlock = activeSessions.allIds.some(
        id => activeSessions.byId[id]?.isActive
      );
      if (!hasActiveUnlock) {
        WidgetService.syncUnlockSessionState(null);
      }
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

      // Check for widget-started focus session not yet adopted into AsyncStorage.
      // updateShieldBalance auto-detects from AsyncStorage, but widget-started
      // sessions only exist in UserDefaults until adoptAndRecoverSession runs.
      const widgetSession = WidgetService.readWidgetStartedSession();
      if (widgetSession) {
        console.log('🛡️ Widget-started focus session detected, keeping shield in focus mode');
        await FamilyControlsModule.updateShieldBalance(store.rewards.balance, true);
      } else {
        await FamilyControlsModule.updateShieldBalance(store.rewards.balance);
      }
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
            // endUnlock stops the unlock LA and shows idle focus LA
            useAppStore.getState().blocklist.endUnlock(data.unlockSessionId as string);
          } else if (data.liveActivityId) {
            LiveActivityService.stopUnlockCountdown(data.liveActivityId as string, 'expired');
            // Show idle focus LA after unlock ends
            const focus = useAppStore.getState().focus;
            const tagId = focus.lastSelectedTagId;
            const tag = tagId ? focus.tags.byId[tagId] : undefined;
            const tagLabel = tag ? `${tag.icon || '🎯'} ${tag.name}` : 'Focus';
            LiveActivityService.showIdleFocusActivity(
              tagLabel,
              tagId || undefined,
              tagId ? focus.lastDurationByTagId[tagId] : undefined
            );
          }
          // Clear unlock state on home screen widget
          WidgetService.syncUnlockSessionState(null);
        }
      }
    );

    // Initialize IAP connection
    useAppStore.getState().subscription.initializeIAP();
    useAppStore.getState().subscription.checkSubscriptionStatus();

    // Restore auth session and listen for auth state changes
    useAppStore.getState().auth.restoreSession();

    // Initialize sync middleware
    const teardownSync = initSyncMiddleware(useAppStore);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          resetSyncSnapshot();
          useAppStore.setState((state) => ({
            auth: {
              ...state.auth,
              user: null,
              isAuthenticated: false,
            },
          }));
        } else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          const user = session.user;
          useAppStore.setState((state) => ({
            auth: {
              ...state.auth,
              user: {
                id: user.id,
                email: user.email ?? null,
                fullName: user.user_metadata?.full_name ?? null,
                avatarUrl: user.user_metadata?.avatar_url ?? null,
              },
              isAuthenticated: true,
            },
          }));

          // Check if cloud has data, then decide initial upload vs pull+merge
          try {
            const remoteData = await useAppStore.getState().sync.pullFromCloud();
            const localState = useAppStore.getState();
            const hasLocalData =
              localState.focus.sessions.allIds.length > 0 ||
              localState.focus.tags.allIds.length > 0;
            const hasRemoteData =
              remoteData &&
              (remoteData.focus.sessions.allIds.length > 0 ||
                remoteData.focus.tags.allIds.length > 0);

            if (hasRemoteData) {
              // Cloud has data — merge (pulls remote into local)
              await useAppStore.getState().sync.triggerSync();
            } else if (hasLocalData) {
              // Cloud empty but local has data — initial upload
              await useAppStore.getState().sync.initialUpload();
            }
            // Both empty — nothing to do
          } catch (error) {
            console.error('Post sign-in sync error:', error);
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
      authListener.subscription.unsubscribe();
      useAppStore.getState().subscription.teardownIAP();
      teardownSync();
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
          usageCount: tag.usageCount ?? 0,
        };
      });
      WidgetService.syncTagList(tagList);

      // Sync the currently selected tag for the small widget
      const selectedTagId = store.focus.lastSelectedTagId;
      WidgetService.syncSelectedTagId(selectedTagId);
    } catch (error) {
      console.error('📱 [Widget] Failed to sync tag list:', error);
    }
  };

  useEffect(() => {
    if (isHydrated && mainStoreHydrated) {
      checkExpiredUnlockSessions('mount');
      syncShieldConfiguration('mount');
      syncWidgetTagList();
      // Sync currentSelectionId so native StopUnlockIntent can re-block apps
      WidgetService.syncCurrentSelectionId(useAppStore.getState().blocklist.currentSelectionId);
    }
  }, [isHydrated, mainStoreHydrated]);

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
          console.log('🛡️ [SHIELD_LAYOUT] Focus session active (AsyncStorage), skipping unlock sheet');
          return;
        }

        // Also check for widget-started sessions not yet adopted into AsyncStorage
        const widgetSession = WidgetService.readWidgetStartedSession();
        if (widgetSession) {
          console.log('🛡️ [SHIELD_LAYOUT] Widget-started focus session pending adoption, skipping unlock sheet');
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
        checkExpiredUnlockSessions('foreground');
        syncShieldConfiguration('foreground');
        syncWidgetTagList();
        WidgetService.syncCurrentSelectionId(useAppStore.getState().blocklist.currentSelectionId);

        // Re-check subscription status
        useAppStore.getState().subscription.checkSubscriptionStatus();

        // Flush any pending offline sync operations
        useAppStore.getState().sync.flushOfflineQueue();
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
  const systemColorScheme = useColorScheme();

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
          <StatusBar />
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
                backgroundColor: systemColorScheme === 'dark' ? '#1B1C30' : '#F5E6D3',
              }}>
              <Text style={{ color: systemColorScheme === 'dark' ? '#FFFFFF' : '#5D4E37' }}>Loading...</Text>
            </View>
          )}
        </GestureHandlerRootView>
      </AnimatedSplashScreen>
    </ErrorBoundary>
  );
}
