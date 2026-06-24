import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, FlatList, ScrollView, useWindowDimensions, useColorScheme, Pressable, ActivityIndicator, TextInput, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AnalyticsTracker } from '../src/services/analytics';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../src/components/ui/Typography';
import { Button } from '../src/components/ui/Button';
import { TagColorPicker } from '../src/components/focus';
import { useUnifiedStore } from '../src/store/unified-store';
import { useAppStore } from '../src/store';
import { useTranslation } from 'react-i18next';
import { LanguageTrigger } from '../src/components/settings/LanguageSelector';

const SUGGESTED_EMOJIS = ['📚', '💼', '🏋️', '🎨', '🧘', '💻', '📖', '🎵'];

// Slide content is keyed by translation namespace; the title/description strings
// are resolved with t() at render time (see renderItem below).
const ONBOARDING_SLIDES = [
  { id: '1', key: 'slide1', iconName: 'leaf-outline', iconColor: '#51BC6F', interactive: false },
  { id: '2', key: 'slide2', iconName: 'timer-outline', iconColor: '#6592E9', interactive: true },
  { id: '3', key: 'slide3', iconName: 'shield-checkmark-outline', iconColor: '#EF786C', interactive: false },
  { id: '4', key: 'slide4', iconName: 'megaphone-outline', iconColor: '#F5A623', interactive: false },
] as const;

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Tag creation state
  const [tagName, setTagName] = useState('');
  const [tagEmoji, setTagEmoji] = useState('📚');
  const [tagColor, setTagColor] = useState('#6592E9');
  const [tagCreated, setTagCreated] = useState(false);

  const { isLoading: isSigningIn, error: signInError } = useAppStore((state) => state.auth);
  const signInWithApple = useAppStore((state) => state.auth.signInWithApple);
  const signInWithEmail = useAppStore((state) => state.auth.signInWithEmail);
  const clearAuthError = useAppStore((state) => state.auth.clearAuthError);
  const createTag = useAppStore((state) => state.focus.createTag);

  // Shared post-sign-in navigation: mark onboarding seen and enter the app.
  const finishSignIn = useCallback(async () => {
    const { isAuthenticated } = useAppStore.getState().auth;
    if (!isAuthenticated) return;

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
  }, []);

  const handleSignIn = useCallback(async () => {
    await signInWithApple();
    await finishSignIn();
  }, [signInWithApple, finishSignIn]);

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

  const handleCreateTag = () => {
    if (!tagName.trim() || !tagEmoji || tagCreated) return;
    createTag({
      name: tagName.trim(),
      icon: tagEmoji,
      color: tagColor,
    });
    setTagCreated(true);
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

  // Tag creation is optional. If the user filled in the form (name + emoji),
  // create the tag before advancing; otherwise just skip ahead.
  const tagFormReady = !!tagName.trim() && !!tagEmoji;
  const handleInteractiveNext = () => {
    if (!tagCreated && tagFormReady) {
      handleCreateTag();
    }
    handleNext();
  };

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
    // Interactive tag creation slide
    if (item.interactive) {
      return (
        <View style={{ width }} className="flex-1 px-8 pt-16">
          {/* Header section */}
          <View className="items-center mb-10">
            <View className="mb-5">
              <Ionicons name={item.iconName as any} size={56} color={item.iconColor} />
            </View>
            <Typography variant="headline-24" color="primary" className="mb-2 text-center">
              {title}
            </Typography>
            <Typography variant="body-14" color="secondary" className="text-center">
              {description}
            </Typography>
          </View>

          {tagCreated ? (
            // Success state
            <View className="items-center mt-8">
              <View
                className="w-20 h-20 rounded-2xl items-center justify-center mb-4"
                style={{ backgroundColor: tagColor + '20', borderWidth: 2, borderColor: tagColor }}
              >
                <Text style={{ fontSize: 36 }}>{tagEmoji}</Text>
              </View>
              <Typography variant="subtitle-16" color="primary" className="mb-1">
                {tagName}
              </Typography>
              <View className="flex-row items-center mt-2">
                <Ionicons name="checkmark-circle" size={20} color="#51BC6F" />
                <Typography variant="body-14" className="ml-1.5" style={{ color: '#51BC6F' }}>
                  {t('onboarding.tagCreated')}
                </Typography>
              </View>
            </View>
          ) : (
            // Creation form
            <View className="w-full self-center" style={{ maxWidth: 320 }}>
              {/* Emoji selector */}
              <Typography variant="body-12" color="secondary" className="mb-2">
                {t('onboarding.pickEmoji')}
              </Typography>
              <View className="flex-row flex-wrap mb-6" style={{ gap: 10 }}>
                {SUGGESTED_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => setTagEmoji(emoji)}
                    className="w-11 h-11 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: tagEmoji === emoji
                        ? (isDark ? '#3A3A4E' : '#E0D4C0')
                        : (isDark ? '#2A2A2A' : '#F0E0CC'),
                      borderWidth: tagEmoji === emoji ? 2 : 0,
                      borderColor: '#6592E9',
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Tag name */}
              <Typography variant="body-12" color="secondary" className="mb-2">
                {t('onboarding.tagName')}
              </Typography>
              <TextInput
                value={tagName}
                onChangeText={setTagName}
                placeholder={t('onboarding.tagNamePlaceholder')}
                placeholderTextColor={isDark ? '#575757' : '#A0A0A0'}
                maxLength={30}
                className="mb-6"
                style={{
                  backgroundColor: isDark ? '#2A2A2A' : '#F0E0CC',
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: isDark ? '#FFFFFF' : '#5D4E37',
                  borderWidth: 1,
                  borderColor: isDark ? '#444' : '#D4C4A8',
                }}
              />

              {/* Color selector */}
              <Typography variant="body-12" color="secondary" className="mb-2">
                {t('onboarding.color')}
              </Typography>
              <ScrollView style={{ maxHeight: 220 }} className="mb-8" nestedScrollEnabled showsVerticalScrollIndicator={false}>
                <TagColorPicker selectedColor={tagColor} onSelectColor={setTagColor} swatchSize={32} />
              </ScrollView>

              {/* Create button */}
              <Pressable
                onPress={handleCreateTag}
                disabled={!tagName.trim()}
                className="bg-primary rounded-xl py-3.5 items-center active:opacity-80"
                style={{ opacity: !tagName.trim() ? 0.5 : 1 }}
              >
                <Typography variant="subtitle-14-semibold" className="text-white">
                  {t('onboarding.createTag')}
                </Typography>
              </Pressable>
            </View>
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
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row justify-between items-center px-5">
        <LanguageTrigger />

        <View className="flex-row items-center">
          <Pressable
            onPress={handleSignIn}
            disabled={isSigningIn}
            className="flex-row items-center py-2 px-3 active:opacity-70"
          >
            {isSigningIn ? (
              <ActivityIndicator size="small" color="#8B7FFF" />
            ) : (
              <Typography variant="body-14" className="text-primary">
                {t('common.continueWithApple')}
              </Typography>
            )}
          </Pressable>

          {/* Dev-only email login (bypasses Apple Sign-In for sandbox testing) */}
          {__DEV__ && (
            <Pressable
              onPress={handleTestLogin}
              disabled={isSigningIn}
              className="flex-row items-center py-2 px-3 active:opacity-70"
            >
              <Typography variant="body-14" className="text-primary opacity-60">
                Test Login
              </Typography>
            </Pressable>
          )}
        </View>
      </View>

      {signInError && (
        <View className="px-5">
          <Typography variant="body-12" className="text-[#FF6B6B] text-center">
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
                index === currentIndex ? 'w-6 bg-primary' : 'w-2 bg-light-border dark:bg-dark-border'
              }`}
            />
          ))}
        </View>

        {/* Action Button — tag creation is optional: show "Skip" until the user
            fills in a tag, then "Next" (which creates the tag and advances). */}
        {ONBOARDING_SLIDES[currentIndex]?.interactive ? (
          <Button
            onPress={handleInteractiveNext}
            variant={tagCreated || tagFormReady ? 'primary' : 'secondary'}
            size="large"
            className="w-full"
          >
            {tagCreated || tagFormReady ? t('common.next') : t('common.skip')}
          </Button>
        ) : (
          <Button onPress={handleNext} variant="primary" size="large" className="w-full">
            {currentIndex === ONBOARDING_SLIDES.length - 1 ? t('common.getStarted') : t('common.next')}
          </Button>
        )}
      </View>
    </View>
  );
}
