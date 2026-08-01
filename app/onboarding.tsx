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
import {
  OnboardingGoalPicker,
  defaultGoalChoice,
  type OnboardingGoalChoice,
} from '../src/components/onboarding/OnboardingGoalPicker';
import { useUnifiedStore } from '../src/store/unified-store';
import { useAppStore } from '../src/store';
import { inferActivityType } from '../src/utils/inferActivityType';
import { useTranslation } from 'react-i18next';
import { LanguageTrigger } from '../src/components/settings/LanguageSelector';
import { SignInSheet } from '../src/components/auth/SignInSheet';
import { showToast } from '../src/components/ui/Toast';

// Slide content is keyed by translation namespace; the title/description strings
// are resolved with t() at render time (see renderItem below).
//
// The arc is deliberate: state the premise and the loop that delivers it, then
// ask for setup work. Setup (tags, goal) sits last so the user has been told
// what they're getting before they're asked to invest in it.
const ONBOARDING_SLIDES = [
  // 1 — the premise and the loop in one: screen time is earned, not banned, and
  // fruit is what a finished session pays out. These were two slides; split, the
  // second only restated the first's "focus, then unlock" in other words.
  //
  // There is deliberately no app-picking slide here. Onboarding never presents
  // the Family Controls prompt — that fires at its own moment of intent (the
  // home screen's blocklist entry), since iOS never re-presents a denied
  // request. A slide that only said "choose the apps" without being able to act
  // on it was asking for a decision the user couldn't make yet.
  {
    id: '1',
    key: 'slide1',
    iconName: 'lock-open-outline',
    iconColor: colors.primary,
    kind: 'info',
  },
  // 2 — pick starter tags.
  {
    id: '2',
    key: 'slide2',
    iconName: 'pricetags-outline',
    iconColor: colors.primary,
    kind: 'tags',
  },
  // 3 — set one daily goal, and finish.
  {
    id: '3',
    key: 'slide3',
    iconName: 'flag-outline',
    iconColor: colors.success,
    kind: 'goal',
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
  // Which tag slot gets a goal, and its daily target. Mirrored from the goal
  // slide the same way; resolved to a real tag in completeOnboarding.
  const goalChoiceRef = useRef<OnboardingGoalChoice>(defaultGoalChoice());
  // Pager scrolling pauses while a suggestion chip is being dragged or the goal
  // slider is in hand, so neither fights the horizontal FlatList for the gesture.
  const [pagerScrollEnabled, setPagerScrollEnabled] = useState(true);

  const {
    isLoading: isSigningIn,
    error: signInError,
    isAuthenticated,
  } = useAppStore((state) => state.auth);
  const signInWithEmail = useAppStore((state) => state.auth.signInWithEmail);
  const clearAuthError = useAppStore((state) => state.auth.clearAuthError);
  const createTag = useAppStore((state) => state.focus.createTag);
  const updateGoal = useAppStore((state) => state.focus.updateGoal);
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

  /**
   * Turn the goal slide's pick into an active goal. Runs after the tag loop, so
   * the chosen slot now maps to a real tag — createTag writes the tag and its
   * auto-created (inactive, zero-target) goal in a single `set`, so that goal is
   * already in the store here and we only ever *activate*, never add.
   */
  const activateChosenGoal = (createdTagIdBySlot: (string | null)[]) => {
    const { slot, dailyTargetMinutes } = goalChoiceRef.current;
    const draft = tagDraftsRef.current[slot];
    if (!draft) return;

    const focusState = useAppStore.getState().focus;

    // Free tier allows exactly one active goal (useSubscriptionGate). A brand-new
    // account has none, but someone who signed in mid-onboarding may have pulled
    // one from the cloud — don't push them past their own cap.
    if (focusState.goals.allIds.some((id) => focusState.goals.byId[id]?.isActive)) return;

    // Normally the tag we just created. If the draft was skipped as a duplicate,
    // fall back to the existing tag of that name — it has its own auto-created
    // goal. A blank name means no tag at all: activate nothing rather than
    // attaching the goal to a tag the user didn't choose.
    let tagId = createdTagIdBySlot[slot];
    if (!tagId) {
      const name = resolveDraftName(draft, t).trim().toLowerCase();
      if (!name) return;
      tagId =
        focusState.tags.allIds.find((id) => {
          const tag = focusState.tags.byId[id];
          return tag && !tag.deletedAt && tag.name.trim().toLowerCase() === name;
        }) ?? null;
    }
    if (!tagId) return;

    const goalId = focusState.goals.allIds.find((id) => focusState.goals.byId[id]?.tagId === tagId);
    if (!goalId) return;

    updateGoal(goalId, {
      isActive: true,
      activePeriod: 'daily',
      dailyTargetMinutes,
      dailyRestDayTargetMinutes: 0,
      isRepeating: true,
    });
  };

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
    // Slot → the tag it produced. Stays null for a draft that was skipped, which
    // the goal resolver below treats as "look for the pre-existing tag instead".
    const createdTagIdBySlot: (string | null)[] = tagDraftsRef.current.map(() => null);
    tagDraftsRef.current.forEach((draft, slot) => {
      const name = resolveDraftName(draft, t);
      if (!name || existingNames.has(name.toLowerCase())) return;
      existingNames.add(name.toLowerCase());
      // Same name→type inference as the tag create/edit sheets; null (no match
      // or ambiguous, e.g. "Workout") leaves the type unset — user can set it later.
      const tag = createTag({
        name,
        icon: draft.emoji,
        color: draft.color,
        activityType: inferActivityType(name) ?? undefined,
      });
      createdTagIdBySlot[slot] = tag.id;
    });

    activateChosenGoal(createdTagIdBySlot);

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

  const handleGoalChoiceChange = useCallback((choice: OnboardingGoalChoice) => {
    goalChoiceRef.current = choice;
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

    // Interactive slides share a compact header above their picker.
    if (item.kind === 'tags' || item.kind === 'goal') {
      return (
        <View style={{ width }} className="flex-1 px-8 pt-12">
          {/* Header section */}
          <View className="mb-6 items-center">
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

          {item.kind === 'tags' ? (
            <OnboardingTagPicker
              onDraftsChange={handleDraftsChange}
              onDragActiveChange={handleDragActiveChange}
            />
          ) : (
            // Reads tagDraftsRef fresh on every render; the pager's extraData is
            // keyed on currentIndex so swiping here re-renders with the latest
            // names and emojis from the tag slide.
            <OnboardingGoalPicker
              drafts={tagDraftsRef.current}
              onChange={handleGoalChoiceChange}
              onDragActiveChange={handleDragActiveChange}
            />
          )}
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

        {/* Offered on every slide so a returning user can always find it, and
            only disappears once they're actually signed in. Signing in from a
            setup slide is safe: finishSignIn only leaves onboarding when the
            cloud says the account is already onboarded, in which case the tags
            and goal picked here are meant to be replaced by the pulled data.
            A brand-new account stays put and keeps its picks. */}
        {isAuthenticated ? (
          <View />
        ) : (
          <View className="flex-row items-center">
            {/* `soft` (tinted pill), not `ghost`: as bare text this read as
                decoration and returning users missed it. */}
            <Button
              variant="soft"
              size="small"
              disabled={isSigningIn}
              onPress={() => setSignInSheetOpen(true)}>
              {isSigningIn ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Typography variant="subtitle-14-semibold" className="text-primary">
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
        // The goal slide renders from tagDraftsRef (a ref, so edits on the tag
        // slide don't re-render the pager on every keystroke). Re-rendering cells
        // when the page changes is what refreshes it on arrival.
        extraData={currentIndex}
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
