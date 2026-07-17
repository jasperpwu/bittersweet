import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, FlatList, useWindowDimensions, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AnalyticsTracker } from '../src/services/analytics';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../src/components/ui/Typography';
import { Button } from '../src/components/ui/Button';
import { colors } from '../src/config/theme';
import {
  OnboardingTagPicker,
  defaultTagDrafts,
  resolveDraftName,
  type OnboardingTagDraft,
} from '../src/components/onboarding/OnboardingTagPicker';
import { useUnifiedStore } from '../src/store/unified-store';
import { useAppStore } from '../src/store';
import { useTranslation } from 'react-i18next';
import { LanguageTrigger } from '../src/components/settings/LanguageSelector';
import { SignInSheet } from '../src/components/auth/SignInSheet';
import { showToast } from '../src/components/ui/Toast';

// Slide content is keyed by translation namespace; the title/description strings
// are resolved with t() at render time (see renderItem below).
const ONBOARDING_SLIDES = [
  { id: '1', key: 'slide1', iconName: 'leaf-outline', iconColor: '#51BC6F', interactive: false },
  { id: '2', key: 'slide2', iconName: 'timer-outline', iconColor: '#6592E9', interactive: true },
  {
    id: '3',
    key: 'slide3',
    iconName: 'shield-checkmark-outline',
    iconColor: '#EF786C',
    interactive: false,
  },
  {
    id: '4',
    key: 'slide4',
    iconName: 'megaphone-outline',
    iconColor: '#F5A623',
    interactive: false,
  },
] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // The three chosen tag drafts live inside OnboardingTagPicker; a ref mirror
  // (no re-render needed here) lets completeOnboarding read the final values.
  const tagDraftsRef = useRef<OnboardingTagDraft[]>(defaultTagDrafts());
  // Pager scrolling pauses while a suggestion chip is being dragged, so the
  // drag doesn't fight the horizontal FlatList.
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);

  const {
    isLoading: isSigningIn,
    error: signInError,
    isAuthenticated,
  } = useAppStore((state) => state.auth);
  const signInWithEmail = useAppStore((state) => state.auth.signInWithEmail);
  const clearAuthError = useAppStore((state) => state.auth.clearAuthError);
  const createTag = useAppStore((state) => state.focus.createTag);
  const [signInSheetOpen, setSignInSheetOpen] = useState(false);

  // Shared post-sign-in navigation: mark onboarding seen and enter the app.
  const finishSignIn = useCallback(async () => {
    const { isAuthenticated } = useAppStore.getState().auth;
    if (!isAuthenticated) return;

    showToast(t('common.signedInSuccessfully'), 'success', undefined, undefined, 'bottom');

    // The cloud is the source of truth for whether this account already finished
    // onboarding. Existing/onboarded account → enter the app. Brand-new account
    // (no settings row yet, or has_seen_onboarding=false) → keep the user in
    // onboarding so this "Sign in" button can't let a new account skip it; they'll
    // mark + upload hasSeenOnboarding via completeOnboarding at the end. On a read
    // failure (null) default to entering the app so a returning user is never trapped.
    const onboarded = await useAppStore.getState().sync.fetchOnboardingCompleted();
    if (onboarded !== false) {
      router.replace('/(tabs)');
    }
  }, [t]);

  // Dev-only: email/password login to bypass Apple Sign-In (e.g. when testing
  // with an Apple sandbox account). Hardcoded test credentials.
  const handleTestLogin = useCallback(async () => {
    await signInWithEmail('jasper@test.com', 'Test123456!');
    await finishSignIn();
  }, [signInWithEmail, finishSignIn]);

  // Auto-clear error after 3 seconds
  useEffect(() => {
    if (signInError) {
      const timer = setTimeout(clearAuthError, 3000);
      return () => clearTimeout(timer);
    }
  }, [signInError, clearAuthError]);

  const completeOnboarding = async () => {
    // Turn the three onboarding tag drafts into real, persisted tags. Until
    // this point they were in-memory suggestions only. Skip blank names and
    // names that already exist (defensive — e.g. a brand-new account whose
    // initialUpload already ran can't create duplicates on a re-entry).
    const focusState = useAppStore.getState().focus;
    const existingNames = new Set(
      focusState.tags.allIds
        .map((id) => focusState.tags.byId[id])
        .filter((tag) => tag && !tag.deletedAt)
        .map((tag) => tag!.name.trim().toLowerCase())
    );
    for (const draft of tagDraftsRef.current) {
      const name = resolveDraftName(draft, t);
      if (!name || existingNames.has(name.toLowerCase())) continue;
      existingNames.add(name.toLowerCase());
      createTag({ name, icon: draft.emoji, color: draft.color });
    }

    // Set hasSeenOnboarding to true in the store
    const updatePreferences = useUnifiedStore.getState().updatePreferences;
    if (updatePreferences) {
      await updatePreferences({ hasSeenOnboarding: true });
    }
    // If the user signed in during onboarding (via the header button), they're a
    // brand-new account that stayed to finish — push hasSeenOnboarding to the cloud
    // now. Otherwise the sync middleware's first-change baseline skip can drop it,
    // making onboarding reappear on their next device.
    if (useAppStore.getState().auth.isAuthenticated) {
      await useAppStore.getState().sync.syncSettings();
    }
    // Analytics: activation-funnel endpoint.
    AnalyticsTracker.track('onboarding_completed');
    // Navigate to the main tabs
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      completeOnboarding();
    }
  };

  const handleDraftsChange = useCallback((drafts: OnboardingTagDraft[]) => {
    tagDraftsRef.current = drafts;
  }, []);

  const handleDragActiveChange = useCallback((active: boolean) => {
    setPagerScrollEnabled(!active);
  }, []);

  const onScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    if (index !== currentIndex && index >= 0 && index < ONBOARDING_SLIDES.length) {
      setCurrentIndex(index);
    }
  };

  const renderItem = ({ item }: { item: (typeof ONBOARDING_SLIDES)[number] }) => {
    const title = t(`onboarding.${item.key}.title`);
    const description = t(`onboarding.${item.key}.description`);
    // Interactive tag picker slide — three editable suggestions plus a
    // drag-to-swap pool. Drafts stay in memory until completeOnboarding.
    if (item.interactive) {
      return (
        <View style={{ width }} className="flex-1 px-8 pt-12">
          {/* Header section */}
          <View className="mb-8 items-center">
            <View className="mb-4">
              <Ionicons name={item.iconName as any} size={48} color={item.iconColor} />
            </View>
            <Typography variant="headline-24" color="primary" className="mb-2 text-center">
              {title}
            </Typography>
            <Typography variant="body-14" color="secondary" className="text-center">
              {description}
            </Typography>
          </View>

          <OnboardingTagPicker
            onDraftsChange={handleDraftsChange}
            onDragActiveChange={handleDragActiveChange}
          />
        </View>
      );
    }

    // Standard info slide
    return (
      <View style={{ width }} className="flex-1 items-center justify-center px-8">
        <View className="mb-12 items-center justify-center">
          <Ionicons name={item.iconName as any} size={100} color={item.iconColor} />
        </View>
        <Typography variant="headline-24" color="primary" className="mb-4 text-center">
          {title}
        </Typography>
        <Typography variant="body-16" color="primary" className="text-center opacity-80">
          {description}
        </Typography>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Header: language selector (left) + sign-in (right) */}
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="flex-row items-center justify-between px-5">
        <LanguageTrigger />

        {/* Once signed in, the header offers no sign-in entry points */}
        {isAuthenticated ? (
          <View />
        ) : (
          <View className="flex-row items-center">
            <Button
              variant="ghost"
              size="small"
              disabled={isSigningIn}
              className="flex-row px-3 py-2"
              onPress={() => setSignInSheetOpen(true)}>
              {isSigningIn ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Typography variant="body-14" className="text-primary">
                  {t('common.signIn')}
                </Typography>
              )}
            </Button>

            {/* Dev-only email login (bypasses Apple Sign-In for sandbox testing) */}
            {__DEV__ && (
              <Pressable
                onPress={handleTestLogin}
                disabled={isSigningIn}
                className="flex-row items-center px-3 py-2 active:opacity-70">
                <Typography variant="body-14" className="text-primary opacity-60">
                  Test Login
                </Typography>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {signInError && (
        <View className="px-5">
          <Typography variant="body-12" color="error" className="text-center">
            {signInError}
          </Typography>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={pagerScrollEnabled}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      />

      <View className="px-8 pb-12 pt-4">
        {/* Pagination Dots */}
        <View className="mb-8 flex-row items-center justify-center">
          {ONBOARDING_SLIDES.map((_, index) => (
            <View
              key={index}
              className={`mx-1 h-2 rounded-full ${
                index === currentIndex
                  ? 'w-6 bg-primary'
                  : 'w-2 bg-light-border dark:bg-dark-border'
              }`}
            />
          ))}
        </View>

        {/* Action Button */}
        <Button onPress={handleNext} variant="primary" size="large" className="w-full">
          {currentIndex === ONBOARDING_SLIDES.length - 1
            ? t('common.getStarted')
            : t('common.next')}
        </Button>
      </View>

      <SignInSheet
        visible={signInSheetOpen}
        onClose={() => setSignInSheetOpen(false)}
        onSignedIn={finishSignIn}
      />
    </View>
  );
}
