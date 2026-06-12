import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, FlatList, useWindowDimensions, useColorScheme, Pressable, ActivityIndicator, TextInput, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../src/components/ui/Typography';
import { Button } from '../src/components/ui/Button';
import { useUnifiedStore } from '../src/store/unified-store';
import { useAppStore } from '../src/store';

const TAG_COLORS = ['#6592E9', '#51BC6F', '#FFC107', '#FF9800', '#FD5B71', '#9C27B0', '#9E9E9E', '#2196F3'];

const SUGGESTED_EMOJIS = ['📚', '💼', '🏋️', '🎨', '🧘', '💻', '📖', '🎵'];

const ONBOARDING_DATA = [
  {
    id: '1',
    title: 'Focus and Plant',
    description: 'Stay focused to grow your tree and later enjoy the fruits of your hard work.',
    iconName: 'leaf-outline',
    iconColor: '#51BC6F',
    interactive: false,
  },
  {
    id: '2',
    title: 'Create Your First Tag',
    description: 'Tags help you categorize your focus sessions. Create one to get started!',
    iconName: 'timer-outline',
    iconColor: '#6592E9',
    interactive: true,
  },
  {
    id: '3',
    title: 'Earn Fruits & Unlock Apps',
    description: 'Use the fruits earned from focus sessions to unlock apps in your blocklist.',
    iconName: 'shield-checkmark-outline',
    iconColor: '#EF786C',
    interactive: false,
  },
  {
    id: '4',
    title: 'Welcome to Bittersweet',
    description:
      'We are actively developing this app and would love your feedback to shape its future.',
    iconName: 'megaphone-outline',
    iconColor: '#F5A623',
    interactive: false,
  },
];

export default function OnboardingScreen() {
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
    if (isAuthenticated) {
      const updatePreferences = useUnifiedStore.getState().updatePreferences;
      if (updatePreferences) {
        await updatePreferences({ hasSeenOnboarding: true });
      }
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
    await signInWithEmail('jasper@test.com', 'test');
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
    if (currentIndex < ONBOARDING_DATA.length - 1) {
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
    if (index !== currentIndex && index >= 0 && index < ONBOARDING_DATA.length) {
      setCurrentIndex(index);
    }
  };

  const renderItem = ({ item }: { item: (typeof ONBOARDING_DATA)[0] }) => {
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
              {item.title}
            </Typography>
            <Typography variant="body-14" color="secondary" className="text-center">
              {item.description}
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
                  Tag created!
                </Typography>
              </View>
            </View>
          ) : (
            // Creation form
            <View className="w-full self-center" style={{ maxWidth: 320 }}>
              {/* Emoji selector */}
              <Typography variant="body-12" color="secondary" className="mb-2">
                Pick an emoji
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
                Tag name
              </Typography>
              <TextInput
                value={tagName}
                onChangeText={setTagName}
                placeholder="e.g. Study, Work, Exercise"
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
                Color
              </Typography>
              <View className="flex-row flex-wrap mb-8" style={{ gap: 10 }}>
                {TAG_COLORS.map((color) => (
                  <Pressable
                    key={color}
                    onPress={() => setTagColor(color)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: color,
                      borderWidth: tagColor === color ? 3 : 0,
                      borderColor: '#FFFFFF',
                    }}
                  />
                ))}
              </View>

              {/* Create button */}
              <Pressable
                onPress={handleCreateTag}
                disabled={!tagName.trim()}
                className="bg-primary rounded-xl py-3.5 items-center active:opacity-80"
                style={{ opacity: !tagName.trim() ? 0.5 : 1 }}
              >
                <Typography variant="subtitle-14-semibold" className="text-white">
                  Create Tag
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
          {item.title}
        </Typography>
        <Typography variant="body-16" color="primary" className="text-center opacity-80">
          {item.description}
        </Typography>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      {/* Sign-in button */}
      <View style={{ paddingTop: insets.top + 8 }} className="flex-row justify-end items-center px-5">
        <Pressable
          onPress={handleSignIn}
          disabled={isSigningIn}
          className="flex-row items-center py-2 px-3 active:opacity-70"
        >
          {isSigningIn ? (
            <ActivityIndicator size="small" color="#8B7FFF" />
          ) : (
            <Typography variant="body-14" className="text-primary">
              Already a user? Sign in
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

      {signInError && (
        <View className="px-5">
          <Typography variant="body-12" className="text-[#FF6B6B] text-center">
            {signInError}
          </Typography>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={ONBOARDING_DATA}
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
          {ONBOARDING_DATA.map((_, index) => (
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
        {ONBOARDING_DATA[currentIndex]?.interactive ? (
          <Button
            onPress={handleInteractiveNext}
            variant={tagCreated || tagFormReady ? 'primary' : 'secondary'}
            size="large"
            className="w-full"
          >
            {tagCreated || tagFormReady ? 'Next' : 'Skip'}
          </Button>
        ) : (
          <Button onPress={handleNext} variant="primary" size="large" className="w-full">
            {currentIndex === ONBOARDING_DATA.length - 1 ? 'Get Started' : 'Next'}
          </Button>
        )}
      </View>
    </View>
  );
}
