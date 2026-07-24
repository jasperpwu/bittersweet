import 'react-native-gesture-handler';
import '../global.css';
import '../src/i18n';

import { Stack, router, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from '../src/hooks/useFonts';
import { colors } from '../src/config/theme';
import { View, Text, useColorScheme } from 'react-native';
import { StatusBar } from '../src/components/ui/StatusBar';
import { AnimatedSplashScreen } from '../src/components/ui/AnimatedSplashScreen';
import { ErrorBoundary } from '../src/components/ui/ErrorBoundary';
import { useAppState, initializeUnifiedStore, clearUnifiedStoreData } from '../src/store/unified-store';
import { useDeviceActivityListener } from '../src/hooks/useDeviceActivityListener';
import { useGoalNudgeNotifications } from '../src/hooks/useGoalNudgeNotifications';
import { useTodoNotifications } from '../src/hooks/useTodoNotifications';
import { useWeeklyCoach } from '../src/hooks/useWeeklyCoach';
import { useApplyLanguage } from '../src/hooks/useApplyLanguage';
import { useEffect, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { UnlockSnackbar } from '../src/components/ui/UnlockSnackbar';
import { Toast } from '../src/components/ui/Toast';
import { LiveActivityService } from '../src/services/LiveActivityService';
import { WidgetService } from '../src/services/WidgetService';
import { syncWidgetTodos } from '../src/services/widgetTodos';
import { syncHealthKitWorkouts } from '../src/services/health/syncHealthKitWorkouts';
import {
  backfillLocalSessionPhotos,
  deleteAllSessionPhotos,
} from '../src/services/sessionPhotoService';
import { deleteAllPurchasePhotos } from '../src/services/purchasePhotoService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore, clearAllStoreData } from '../src/store';
import { supabase } from '../src/config/supabase';
import { initSyncMiddleware, resetSyncSnapshot } from '../src/store/middleware/syncMiddleware';
import { takeHeldSessionId } from '../src/services/sync/heldSession';
import { storeHydrationSettled } from '../src/store/middleware/persistence';

import { calculateGoalProgress, getTargetForDate } from '../src/utils/goalProgress';
import { configureCrisp, openChat } from '../src/services/crisp';
import { useDeepLinkHandler } from '../src/hooks/useDeepLinkHandler';
import { useQuickActionHandler } from '../src/hooks/useQuickActionHandler';
import { PushNotificationService } from '../src/services/notifications/push';
import { ActivityPingService } from '../src/services/notifications/activity';
import { getMotionPermissionStatus } from '../src/services/motionInsights';
import { AnalyticsTracker } from '../src/services/analytics';
import { getInstalledWidgetFamilies } from '../modules/widget-info';
import { installNavigationGuard } from '../src/utils/navigationGuard';

// Dedupe duplicate navigations from fast double-taps (router.push/navigate/replace).
installNavigationGuard();

// Where each re-engagement nudge (data.feature from reengagement-cron) lands
// when tapped. 'suggest' and 'grove' are handled separately (see below), and
// anything unknown falls back to the focus tab.
const REENGAGE_ROUTES: Record<string, string> = {
  goals: '/(tabs)/insights',
  todos: '/(tabs)/journal',
  store: '/fruit-store',
  blocklist: '/(modals)/app-selection',
  health: '/settings/health',
  focus: '/(tabs)',
};

function handleReengageTap(feature: unknown) {
  if (feature === 'suggest') {
    // Mirror the "Chat with us" button: open Support, then the chat overlay.
    router.navigate('/settings/support');
    openChat();
    return;
  }
  if (feature === 'grove') {
    // The "Grow your Grove" nudge only targets users who haven't set up a Grove
    // profile yet — landing them on the Grove tab shows a dead-end "profile not
    // found". Send them to the setup flow instead. If they've since created a
    // profile, go to the tab as usual.
    const hasProfile = !!useAppStore.getState().grove.profile;
    router.push(hasProfile ? '/(tabs)/grove' : '/(modals)/grove-setup');
    return;
  }
  const route =
    (typeof feature === 'string' && REENGAGE_ROUTES[feature]) || REENGAGE_ROUTES.focus;
  router.push(route as never);
}

// Route a tapped notification to its destination. Shared between the live
// response listener and the cold-start check: a tap that launches the app from
// a killed state is delivered via getLastNotificationResponseAsync(), never
// through addNotificationResponseReceivedListener (registered too late).
function routeNotificationTap(data: Record<string, unknown> | undefined) {
  if (data?.type === 'weekly-coach') {
    router.push('/(modals)/ai-coach');
  } else if (data?.type === 'gift') {
    // Gifts (incoming + sent-gift history) live in the fruit store's
    // Custom tab — land the tap there for every gift event.
    router.push('/fruit-store?tab=custom');
  } else if (data?.type === 'reengage') {
    // Re-engagement nudge → deep-link straight to the promoted feature.
    handleReengageTap(data.feature);
  }
}

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

// Mirror the "Motion-based focus rating" toggle to the iOS Motion & Fitness
// permission. Motion is used for nothing but the rating, so the permission IS
// the switch: granted → on, denied/undetermined → off. READ-only (never prompts)
// — the request lives in the preferences toggle / summary primer. Run on cold
// start and on app-foreground so a change made in iOS Settings is picked up.
async function reconcileMotionRatingToggle() {
  const shouldBeEnabled = (await getMotionPermissionStatus()) === 'granted';
  const { useUnifiedStore } = require('../src/store/unified-store');
  const store = useUnifiedStore.getState();
  if (store.preferences.rawAccelRatingEnabled !== shouldBeEnabled) {
    await store.updatePreferences({ rawAccelRatingEnabled: shouldBeEnabled });
  }
}

export default function RootLayout() {
  const { fontsLoaded } = useFonts();
  const { isHydrated, initializeApp } = useAppState();
  // Main-store hydration gate. Not the `s.ui.isHydrated` selector: that flag is set
  // by an in-place mutation in onRehydrateStorage that never notifies subscribers,
  // so a render gated on it can miss the transition and hang.
  const [mainStoreHydrated, setMainStoreHydrated] = useState(() =>
    useAppStore.persist.hasHydrated()
  );
  useEffect(() => {
    let cancelled = false;
    storeHydrationSettled.then(() => {
      if (!cancelled) setMainStoreHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const [showUnlockSheet, setShowUnlockSheet] = useState(false);
  // Flips true once restoreSession() has settled, so auth-dependent routing
  // (the onboarding redirect) never runs against a not-yet-restored session.
  // Matters on reinstall: the Keychain session survives but hasSeenOnboarding
  // doesn't, and redirecting before auth restores would trap a signed-in
  // returning user in onboarding.
  const [sessionRestored, setSessionRestored] = useState(false);

  // Apply the persisted/synced language preference to i18next
  useApplyLanguage();

  // Initialize Device Activity Listener
  const { isListening } = useDeviceActivityListener();

  // Schedule/cancel goal nudge notifications
  useGoalNudgeNotifications();

  // Schedule/cancel per-todo start-time reminders
  useTodoNotifications();

  // AI Focus Coach: generate weekly report + schedule the weekly nudge
  useWeeklyCoach();

  // Handle invite deep links
  useDeepLinkHandler();

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
    configureCrisp();

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
            // Show idle focus LA after unlock ends. The unlock LA was just
            // dismissed, so CREATE a fresh idle activity (ensureIdleFocusActivity)
            // rather than update-only — otherwise nothing shows.
            const focus = useAppStore.getState().focus;
            const tagId = focus.lastSelectedTagId;
            const tag = tagId ? focus.tags.byId[tagId] : undefined;
            const tagLabel = tag ? `${tag.icon || '🎯'} ${tag.name}` : 'Focus';
            LiveActivityService.ensureIdleFocusActivity(
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

    // Route notification taps (weekly coach, gifts, re-engagement nudges).
    const coachResponseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        routeNotificationTap(response.notification.request.content.data);
      }
    );

    // Cold start: when a tap launched the app, the response never reaches the
    // listener above — pick it up here, then clear it so a later remount
    // doesn't re-navigate.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      routeNotificationTap(response.notification.request.content.data);
      Notifications.clearLastNotificationResponseAsync();
    });

    // Fetch server-side subscription state immediately (before IAP init completes)
    useAppStore.getState().subscription.fetchTierFromServer();

    // Initialize IAP connection
    useAppStore.getState().subscription.initializeIAP();

    // Initialize sync middleware
    const teardownSync = initSyncMiddleware(useAppStore);

    // Gate the auth listener on restoreSession() completing first, so auth
    // state is populated before INITIAL_SESSION replays and before any
    // auth-dependent routing runs.
    // Both are additionally gated on main-store hydration settling: the
    // INITIAL_SESSION/SIGNED_IN handlers read local state and apply sync results
    // to the store, and anything read from or written to a not-yet-hydrated store
    // is wrong — writes get erased by the hydration apply, reads see empty slices.
    let authListener: { subscription: { unsubscribe: () => void } } | undefined;
    let authListenerCancelled = false;

    storeHydrationSettled
      .then(() => useAppStore.getState().auth.restoreSession())
      .then(() => {
        setSessionRestored(true);
        if (authListenerCancelled) return;
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT') {
            console.log('🚪 SIGNED_OUT — clearing all app data');
            // Drop the analytics identity so post-logout events don't attribute to
            // the previous user (privacy — no identity survives for the next person).
            AnalyticsTracker.reset();
            PushNotificationService.unregisterPushToken();
            resetSyncSnapshot();
            useAppStore.getState().grove.resetGrove();
            WidgetService.clearSupabaseCredentials();

            // 1. Unblock any current selection and clear shield configuration
            try {
              const currentSelectionId = useAppStore.getState().blocklist.currentSelectionId;
              if (currentSelectionId) {
                const { FamilyControlsModule } = await import(
                  '../src/modules/BitterSweetFamilyControls'
                );
                await FamilyControlsModule.removeRestrictions(currentSelectionId);
                await FamilyControlsModule.clearShieldConfiguration();
              }
            } catch (e) {
              console.error('Error removing restrictions on sign-out:', e);
            }

            // 2. Clear all widget data from UserDefaults
            WidgetService.clearAllWidgetData();

            // 3. Clear AsyncStorage
            try {
              await AsyncStorage.clear();
            } catch (e) {
              console.error('Error clearing AsyncStorage on sign-out:', e);
            }

            // 4. Delete locally saved photo files (session + reward photos)
            try {
              await deleteAllSessionPhotos();
              await deleteAllPurchasePhotos();
            } catch (e) {
              console.error('Error deleting local photos on sign-out:', e);
            }

            // 5. Clear/reset all store states
            clearAllStoreData(false); // keepAuth = false
            clearUnifiedStoreData();
          } else if (event === 'TOKEN_REFRESHED' && session?.user) {
            // Sync refreshed JWT so native intents always have a valid token
            WidgetService.syncSupabaseCredentials(session.user.id, session.access_token);
          }

          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
            console.log('🔑 onAuthStateChange fired:', event, 'user:', session.user.id);
            const user = session.user;

            // Detect user switch — clear local data if signing in as a different user
            const previousUserId = useAppStore.getState().auth.lastSignedInUserId;
            const isUserSwitch = previousUserId && previousUserId !== user.id;
            if (isUserSwitch) {
              console.log(
                '🔄 User switch detected:',
                previousUserId,
                '→',
                user.id,
                '— clearing local data'
              );
              resetSyncSnapshot();
              useAppStore.getState().grove.resetGrove();

              // 1. Unblock any current selection and clear shield configuration
              try {
                const currentSelectionId = useAppStore.getState().blocklist.currentSelectionId;
                if (currentSelectionId) {
                  const { FamilyControlsModule } = await import(
                    '../src/modules/BitterSweetFamilyControls'
                  );
                  await FamilyControlsModule.removeRestrictions(currentSelectionId);
                  await FamilyControlsModule.clearShieldConfiguration();
                }
              } catch (e) {
                console.error('Error removing restrictions on user switch:', e);
              }

              // 2. Clear all widget data
              WidgetService.clearAllWidgetData();

              // 3. Clear AsyncStorage
              try {
                await AsyncStorage.clear();
              } catch (e) {
                console.error('Error clearing AsyncStorage on user switch:', e);
              }

              // 4. Delete locally saved photo files (session + reward photos)
              try {
                await deleteAllSessionPhotos();
                await deleteAllPurchasePhotos();
              } catch (e) {
                console.error('Error deleting local photos on user switch:', e);
              }

              // 5. Clear/reset all store states (keeping newly signed in auth)
              clearAllStoreData(true);
              clearUnifiedStoreData();
            }

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
                lastSignedInUserId: user.id,
              },
            }));

            // Attribute all subsequent analytics events to this user, and flip
            // the cohort flag so signed-in vs. anonymous persons are separable in
            // PostHog. `first_signed_in_at` is set-once for signup-cohort analysis.
            AnalyticsTracker.identify(user.id);
            AnalyticsTracker.setPersonProperties(
              { is_signed_in: true },
              { first_signed_in_at: new Date().toISOString() }
            );

            // Sync Supabase credentials to UserDefaults for native intent REST calls
            WidgetService.syncSupabaseCredentials(user.id, session.access_token);

            // supabase-js re-emits SIGNED_IN on token auto-refresh and app
            // foreground for the user who is ALREADY signed in. That is not a
            // fresh sign-in — running the existing-account clear+pullAndApply
            // below would wipe any local-only data that hasn't flushed to cloud
            // yet (e.g. a session the user just finished and is still rating on
            // the summary modal), and reset rewards.balance to the cloud value.
            // Detect it: a genuine sign-in always has previousUserId !== user.id
            // (sign-out nulls lastSignedInUserId, and only this handler sets it
            // after a full sign-in). Same user + SIGNED_IN => redundant re-emit;
            // creds were already synced above, so there is nothing more to do.
            const isSignedInReemit = event === 'SIGNED_IN' && previousUserId === user.id;

            // Sync strategy depends on auth event type
            try {
              if (isSignedInReemit) {
                console.log(
                  '🔁 Redundant SIGNED_IN for current user — skipping clear/pull (preserving local data)'
                );
              } else if (event === 'SIGNED_IN') {
                // Distinguish a brand-new sign-up from a sign-in to an existing
                // account. The app can't tell directly (Apple Sign-In auto-creates
                // accounts), so we probe the cloud: a brand-new account has no
                // sessions/tags yet (the signup trigger seeds only profiles +
                // rewards). If the cloud is empty we PRESERVE local data and upload
                // it (so a pre-account user keeps everything they built); if the
                // cloud has data we CLEAR local and pull the cloud clean.
                // pullFromCloud() returns null on network error — that falls into
                // the PRESERVE branch, which is safe: initialUpload is upsert-only,
                // so a misclassified existing user neither loses local data nor
                // wipes cloud data, and the next cold-start reconciles.
                //
                // Consume the post-session hold marker up front — it is single-use
                // and must not leak into a later auth event. In the brand-new
                // branch it is simply discarded (initialUpload preserves all local
                // data anyway); only the existing-account branch acts on it.
                const heldSessionId = takeHeldSessionId();
                const remoteData = await useAppStore.getState().sync.pullFromCloud();
                const cloudHasData =
                  !!remoteData &&
                  (remoteData.focus.sessions.allIds.length > 0 ||
                    remoteData.focus.tags.allIds.length > 0);

                if (cloudHasData) {
                  console.log(
                    '🔄 SIGNED_IN (existing account) — clearing local data, pulling cloud clean'
                  );

                  // Post-first-session sign-in: push the held session (and its tag)
                  // to the cloud BEFORE the wipe below destroys the only copy — the
                  // pullAndApply afterwards brings it back down as cloud data. After
                  // a user-switch wipe the session is already gone from the store,
                  // so this no-ops (no cross-account leak).
                  let heldFruits = 0;
                  if (heldSessionId) {
                    heldFruits = await useAppStore
                      .getState()
                      .sync.pushHeldSessionToCloud(heldSessionId, remoteData);
                  }

                  // Drop the sync baseline + queue BEFORE wiping, like the sign-out and
                  // user-switch paths do. Without this, clearAllStoreData below fires the
                  // sync middleware with the old baseline while auth is still valid, and
                  // its 2s debounced diff races pullAndApply's network pull — if the pull
                  // is slower, the diff sees every wiped row as locally deleted and
                  // soft-deletes the user's cloud data.
                  resetSyncSnapshot();

                  // 1. Unblock any current selection and clear shield configuration
                  try {
                    const currentSelectionId = useAppStore.getState().blocklist.currentSelectionId;
                    if (currentSelectionId) {
                      const { FamilyControlsModule } = await import(
                        '../src/modules/BitterSweetFamilyControls'
                      );
                      await FamilyControlsModule.removeRestrictions(currentSelectionId);
                      await FamilyControlsModule.clearShieldConfiguration();
                    }
                  } catch (e) {
                    console.error('Error removing restrictions on sign-in:', e);
                  }

                  // 2. Clear all widget data
                  WidgetService.clearAllWidgetData();

                  // 3. Clear AsyncStorage
                  try {
                    await AsyncStorage.clear();
                  } catch (e) {
                    console.error('Error clearing AsyncStorage on sign-in:', e);
                  }

                  // 4. Delete locally saved photo files (session + reward photos)
                  try {
                    await deleteAllSessionPhotos();
                    await deleteAllPurchasePhotos();
                  } catch (e) {
                    console.error('Error deleting local photos on sign-in:', e);
                  }

                  // 5. Clear/reset all store states (keeping auth)
                  clearAllStoreData(true);
                  clearUnifiedStoreData();

                  // 6. Restore user auth state
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
                      lastSignedInUserId: user.id,
                    },
                  }));

                  // 7. Pull from cloud and apply directly (no merge)
                  await useAppStore.getState().sync.pullAndApply();

                  // Re-credit the preserved session's fruits on top of the pulled
                  // cloud balance (the pull reset the balance to the cloud value,
                  // which predates this session). The rewards object-sync then
                  // pushes the new balance back up.
                  if (heldFruits > 0) {
                    useAppStore.getState().rewards.earnFruits(heldFruits, 'preserved_session', {
                      sessionId: heldSessionId,
                    });
                  }
                } else {
                  // Brand-new account: keep local data and push it to the cloud.
                  console.log(
                    '🔄 SIGNED_IN (brand-new account) — preserving local data, uploading to cloud'
                  );
                  await useAppStore.getState().sync.initialUpload();
                }
              } else {
                // INITIAL_SESSION (cold start): merge local + cloud
                console.log('🔄 INITIAL_SESSION — merging local with cloud');

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
              }
            } catch (error) {
              console.error('Post sign-in sync error:', error);
            }

            // Blocklist sync is handled inside triggerSync() and pullAndApply()

            // Re-upload session photos stuck with a local file:// photoUrl
            // (journal-attached photos from older builds were never uploaded).
            backfillLocalSessionPhotos().catch((error) =>
              console.warn('Session photo backfill failed:', error)
            );

            // Register push token after sign-in
            PushNotificationService.registerPushToken();

            // Record activity immediately on sign-in (captures timezone for the
            // re-engagement cron even if the app is never backgrounded).
            ActivityPingService.ping(true);

            // Fetch grove profile and social data after sign-in
            try {
              console.log('🌳 Fetching grove profile after sign-in...');
              await useAppStore.getState().grove.fetchProfile();
              const groveState = useAppStore.getState().grove;
              console.log(
                '🌳 Grove profile result:',
                groveState.profile ? 'found' : 'null',
                'isActive:',
                groveState.isActive
              );
              if (groveState.profile && groveState.isActive) {
                groveState.fetchFriends();
                groveState.fetchFeed();
                groveState.fetchFriendRequests();
                groveState.fetchChallenges();
                groveState.fetchGifts();
                groveState.fetchHeartbeatSettings();
                groveState.fetchIncomingCircleInvites();
                groveState.fetchHeartbeatAlerts();
              }
            } catch (error) {
              console.error('🌳 Post sign-in grove fetch error:', error);
            }
          }
        });
        authListener = data;
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
      authListenerCancelled = true;
      notificationSubscription.remove();
      coachResponseSubscription.remove();
      authListener?.subscription.unsubscribe();
      useAppStore.getState().subscription.teardownIAP();
      teardownSync();
    };
  }, []);

  const syncWidgetTagList = () => {
    try {
      const store = useAppStore.getState();
      const { tags, sessions, lastDurationByTagId } = store.focus;

      // Compute most recent session time per tag
      const lastUsedByTag: Record<string, number> = {};
      for (const id of sessions.allIds) {
        const s = sessions.byId[id];
        if (!s) continue;
        const t =
          s.startTime instanceof Date ? s.startTime.getTime() : new Date(s.startTime).getTime();
        if (!lastUsedByTag[s.tagId] || t > lastUsedByTag[s.tagId]) {
          lastUsedByTag[s.tagId] = t;
        }
      }

      const tagList = tags.allIds
        .map((id) => tags.byId[id])
        .filter((tag) => tag && !tag.deletedAt)
        .map((tag) => ({
          id: tag.id,
          name: tag.name,
          icon: tag.icon || '🎯',
          color: tag.color || '#8B4513',
          lastDuration: lastDurationByTagId[tag.id] ?? 15,
          lastUsedAt: lastUsedByTag[tag.id] ?? 0,
        }));
      WidgetService.syncTagList(tagList);

      // Sync the currently selected tag for the small widget
      const selectedTagId = store.focus.lastSelectedTagId;
      WidgetService.syncSelectedTagId(selectedTagId);
    } catch (error) {
      console.error('📱 [Widget] Failed to sync tag list:', error);
    }
  };

  const syncWidgetGoalsData = () => {
    try {
      const store = useAppStore.getState();
      const { goals, sessions, tags } = store.focus;
      const { useUnifiedStore } = require('../src/store/unified-store');
      const restDays: number[] = useUnifiedStore.getState().preferences.restDays ?? [0, 6];

      // Get active goals sorted by sortOrder
      const activeGoals = goals.allIds
        .map((id) => goals.byId[id])
        .filter((g) => g && g.isActive && !g.deletedAt)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      if (activeGoals.length === 0) {
        WidgetService.syncGoalsData([]);
        return;
      }

      // Calculate fresh progress for all goals
      const sessionsArray = sessions.allIds.map((id) => sessions.byId[id]).filter(Boolean);
      const freshProgress = calculateGoalProgress(activeGoals, sessionsArray);

      // Build widget data (top 3)
      const widgetGoals = activeGoals.slice(0, 6).map((goal) => {
        const currentMinutes = freshProgress[goal.id] || 0;
        const effectiveTarget = getTargetForDate(goal, new Date(), restDays);
        const percentage = effectiveTarget > 0 ? (currentMinutes / effectiveTarget) * 100 : 0;

        const period = goal.activePeriod || 'daily';
        // No-period (cumulative) goals surface as "Total" rather than "None".
        const periodLabel = period === 'none' ? 'Total' : period.charAt(0).toUpperCase() + period.slice(1);

        const tag = goal.tagId ? tags.byId[goal.tagId] : null;
        const displayName =
          goal.customName || (tag ? `${tag.icon || ''} ${tag.name} Goal` : 'Goal');

        return {
          name: displayName,
          currentMinutes,
          targetMinutes: effectiveTarget,
          percentage: Math.round(percentage),
          period: periodLabel,
          tagId: goal.tagId || '',
          tagIcon: tag?.icon || '',
          tagColor: tag?.color || '#6592E9',
        };
      });

      WidgetService.syncGoalsData(widgetGoals);
    } catch (error) {
      console.error('📱 [Widget] Failed to sync goals data:', error);
    }
  };

  // Adopt any TODO toggles tapped on the Home Screen widget while the app was
  // backgrounded. The widget already wrote the change to Supabase + UserDefaults;
  // here we mirror it into the store so the sheet matches and the sync middleware
  // enqueues the cloud update (collapses with the native write by id).
  const adoptWidgetTodoToggles = () => {
    try {
      const toggles = WidgetService.checkWidgetTodoToggles();
      if (toggles.length === 0) return;
      const setTodoCompleted = useAppStore.getState().focus.setTodoCompleted;
      for (const toggle of toggles) {
        setTodoCompleted(toggle.id, toggle.completed);
      }
    } catch (error) {
      console.error('📱 [Widget] Failed to adopt widget todo toggles:', error);
    }
  };

  // Handle a "+" tap on the TODO widget: route to the Journal tab and open the
  // new-TODO modal. The param carries the request timestamp so the journal
  // screen treats each tap as a fresh signal.
  const handleWidgetNewTodoRequest = (attempt = 0) => {
    try {
      const ts = WidgetService.checkOpenNewTodoRequest();
      if (ts) {
        router.replace({ pathname: '/(tabs)/journal', params: { newTodo: String(ts) } });
      } else if (attempt < 1) {
        // The intent's perform() (openAppWhenRun) can write the marker a beat
        // after the app becomes active; re-check once shortly after.
        setTimeout(() => handleWidgetNewTodoRequest(attempt + 1), 600);
      }
    } catch (error) {
      console.error('📱 [Widget] Failed to handle new-todo request:', error);
    }
  };

  useEffect(() => {
    if (isHydrated && mainStoreHydrated) {
      checkExpiredUnlockSessions('mount');
      syncShieldConfiguration('mount');
      syncWidgetTagList();
      syncWidgetGoalsData();
      adoptWidgetTodoToggles();
      syncWidgetTodos();
      handleWidgetNewTodoRequest();
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
          console.log(
            '🛡️ [SHIELD_LAYOUT] Focus session active (AsyncStorage), skipping unlock sheet'
          );
          return;
        }

        // Also check for widget-started sessions not yet adopted into AsyncStorage
        const widgetSession = WidgetService.readWidgetStartedSession();
        if (widgetSession) {
          console.log(
            '🛡️ [SHIELD_LAYOUT] Widget-started focus session pending adoption, skipping unlock sheet'
          );
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

    // Cold-start Apple Health sync. The foreground handler only fires on a
    // background→active transition, which never happens on a fresh launch, so
    // a cold start would otherwise miss workouts recorded while the app was
    // killed. Gated on BOTH stores' hydration: it writes imported sessions into
    // the main store (erased if hydration applies afterwards) and validates the
    // linked tag against focus.tags (empty before hydration → import skipped).
    if (isHydrated && mainStoreHydrated) {
      syncHealthKitWorkouts();
    }
  }, [fontsLoaded, isHydrated, mainStoreHydrated]);

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
        syncWidgetGoalsData();
        adoptWidgetTodoToggles();
        syncWidgetTodos();
        handleWidgetNewTodoRequest();
        WidgetService.syncCurrentSelectionId(useAppStore.getState().blocklist.currentSelectionId);

        // Re-check subscription status
        useAppStore.getState().subscription.checkSubscriptionStatus();

        // Flush any pending offline sync operations
        useAppStore.getState().sync.flushOfflineQueue();

        // Repeatable safety net for sessions stranded local-only (e.g. a failed
        // cold-start pull, or a per-row flush failure). Throttled to ≤ once/hour
        // inside the slice; the cold-start triggerSync only runs at launch, and
        // iOS can suspend the app for days between cold starts.
        useAppStore.getState().sync.reconcileLocalSessionsToCloud();

        // Record app activity (debounced) so the re-engagement cron knows the
        // user is still around and resets any inactivity streak.
        ActivityPingService.ping();

        // Re-mirror the motion-rating toggle in case Motion & Fitness was
        // toggled in iOS Settings while the app was backgrounded.
        reconcileMotionRatingToggle();

        // Pull any new Apple Health workouts as sessions (no-ops if disconnected)
        syncHealthKitWorkouts();

        // Record heartbeat activity if grove is active, heartbeat enabled, and not paused
        const groveState = useAppStore.getState().grove;
        if (
          groveState.isActive &&
          groveState.heartbeatSettings?.isEnabled &&
          !groveState.heartbeatSettings?.isPaused
        ) {
          groveState.recordHeartbeatActivity();
        }
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // Snapshot how many ops are still queued as the app backgrounds. A
        // non-zero size that keeps recurring points at a stuck/undeliverable
        // entry — the class that strands a session until a reinstall wipes it.
        AnalyticsTracker.track('sync_queue_size_on_background', {
          size: useAppStore.getState().sync.offlineQueueSize,
        });
      }

      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => subscription?.remove();
  }, [fontsLoaded, isHydrated]);

  // Flush the offline sync queue the instant connectivity is restored. The queue
  // otherwise only flushes on app-foreground or cold-start, so a session completed
  // offline sits unsynced while the app stays continuously foregrounded — and a
  // later wipe (sign-in/out, user switch) before any flush can lose it. Fire only
  // on a real offline→online transition, not NetInfo's initial state emit (the
  // foreground/cold-start paths already cover the launch case). flushOfflineQueue
  // self-guards on auth + an empty queue, so calling it liberally here is safe.
  useEffect(() => {
    let wasOffline = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      if (online && wasOffline) {
        console.log('📶 Connectivity restored — flushing offline sync queue');
        useAppStore.getState().sync.flushOfflineQueue();
      }
      wasOffline = !online;
    });
    return () => unsubscribe();
  }, []);

  // Analytics: authoritative widget-adoption check once per launch. iOS gives no
  // callback when a widget is added, so we ask WidgetCenter which widgets are
  // currently installed and record widget_active + the has_active_widget cohort.
  useEffect(() => {
    if (!(fontsLoaded && isHydrated)) return;
    getInstalledWidgetFamilies().then((families) => {
      if (families.length > 0) {
        AnalyticsTracker.track(
          'widget_active',
          { families },
          { setOnce: { has_active_widget: true } }
        );
        // Installing a widget is the "set up widget" signal — unlock its setup-task claim.
        useAppStore.getState().rewards.markTaskSetup('widget');
      }
    });
    // Backfill the goal setup-task for existing users with an active goal.
    useAppStore.getState().rewards.reconcileSetupTasks();
  }, [fontsLoaded, isHydrated]);

  // Mirror the motion-rating toggle to the iOS Motion & Fitness permission on
  // cold start (foreground handled in the AppState effect below).
  useEffect(() => {
    if (!isHydrated) return;
    reconcileMotionRatingToggle();
  }, [isHydrated]);

  // The app must not become interactive before the MAIN store's hydration settles.
  // The running-timer UI restores from AsyncStorage independently of the store, so
  // without this gate the user can end a session whose store write is then erased
  // when hydration applies the pre-write disk snapshot ("Session not found").
  const isReady = fontsLoaded && isHydrated && mainStoreHydrated;
  const pathname = usePathname();
  const systemColorScheme = useColorScheme();

  // Home Screen quick action (long-press app icon) → Support page + open chat.
  useQuickActionHandler(isReady);

  useEffect(() => {
    // Wait for restoreSession() to settle (sessionRestored) so a reinstall with a
    // surviving Keychain session isn't misread as "not authenticated" — the
    // redirect below would trap that signed-in user in onboarding.
    if (isReady && sessionRestored) {
      const { useUnifiedStore } = require('../src/store/unified-store');
      const hasSeenOnboarding = useUnifiedStore.getState().preferences?.hasSeenOnboarding;
      // An authenticated user has already passed through onboarding (it's the only
      // path to the sign-in button). Don't bounce them back: a sign-in to an existing
      // account briefly wipes hasSeenOnboarding (clearUnifiedStoreData) before
      // pullAndApply restores it from cloud — gating on auth avoids that transient redirect.
      const isAuthenticated = useAppStore.getState().auth?.isAuthenticated;

      if (!hasSeenOnboarding && !isAuthenticated && pathname !== '/onboarding') {
        // Small delay to ensure router is ready
        setTimeout(() => {
          router.replace('/onboarding');
        }, 50);
      }
    }
  }, [isReady, sessionRestored, pathname]);

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
                  name="(modals)/ai-coach"
                  options={{
                    headerShown: false,
                    presentation: 'card',
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
                <Stack.Screen
                  name="(modals)/grove-setup"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen
                  name="(modals)/add-friends"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/friend-requests"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/grove-notifications"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/challenges"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/create-challenge"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/my-session-feed"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/grove-edit"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/inner-circle"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/friend-feed"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="(modals)/invite-preview"
                  options={{
                    headerShown: false,
                    presentation: 'transparentModal',
                    animation: 'none',
                    gestureEnabled: false,
                  }}
                />
                <Stack.Screen
                  name="(modals)/referral-details"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen name="invite/[code]" options={{ headerShown: false }} />
                <Stack.Screen name="refer/[code]" options={{ headerShown: false }} />
                <Stack.Screen name="fruit-store" options={{ headerShown: false }} />
                <Stack.Screen
                  name="(modals)/off-marker"
                  options={{
                    headerShown: false,
                    presentation: 'card',
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="settings/preferences"
                  options={{ headerShown: false, presentation: 'card' }}
                />
                <Stack.Screen
                  name="settings/subscription"
                  options={{ headerShown: false, presentation: 'card' }}
                />
                <Stack.Screen
                  name="settings/grove-settings"
                  options={{ headerShown: false, presentation: 'card' }}
                />
                <Stack.Screen
                  name="settings/support"
                  options={{ headerShown: false, presentation: 'card' }}
                />
                <Stack.Screen
                  name="settings/health"
                  options={{ headerShown: false, presentation: 'card' }}
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
                backgroundColor: systemColorScheme === 'dark' ? colors.dark.background : colors.light.screen,
              }}>
              <Text style={{ color: systemColorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary }}>
                Loading...
              </Text>
            </View>
          )}
        </GestureHandlerRootView>
      </AnimatedSplashScreen>
    </ErrorBoundary>
  );
}
