import React, { useCallback, useMemo } from 'react';
import { I18nManager, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { router, useFocusEffect } from 'expo-router';
import { useAppStore } from '../../store';

const SWIPE_THRESHOLD = 50;
const VELOCITY_THRESHOLD = 500;

const ALL_TABS = ['journal', 'index', 'insights', 'grove', 'settings'] as const;
type TabName = (typeof ALL_TABS)[number];

const TAB_ROUTES: Record<TabName, string> = {
  journal: '/(tabs)/journal',
  index: '/(tabs)',
  insights: '/(tabs)/insights',
  grove: '/(tabs)/grove',
  settings: '/(tabs)/settings',
};

// Module-level: direction the new screen should slide in from.
// 1 = entering from right (swiped left), -1 = entering from left (swiped right)
let pendingSlideDirection: number = 0;

interface SwipeableTabWrapperProps {
  currentTab: TabName;
  children: React.ReactNode;
}

export function SwipeableTabWrapper({ currentTab, children }: SwipeableTabWrapperProps) {
  const { width: screenWidth } = useWindowDimensions();
  const translateX = useSharedValue(0);

  const isGroveActive = useAppStore(
    (s) => s.grove?.profile !== null && s.grove?.isActive !== false
  );

  // When this tab gains focus, play slide-in if triggered by a swipe
  useFocusEffect(
    useCallback(() => {
      if (pendingSlideDirection !== 0) {
        const direction = pendingSlideDirection;
        pendingSlideDirection = 0;

        // Start off-screen: if direction=1 (advancing), the new screen enters
        // from the side the swipe came from — mirrored in RTL to match.
        translateX.value = direction * screenWidth * (I18nManager.isRTL ? -1 : 1);
        translateX.value = withTiming(0, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        translateX.value = 0;
      }
    }, [screenWidth, translateX])
  );

  const handleSwipe = useCallback((direction: number) => {
    const tabs = isGroveActive
      ? [...ALL_TABS]
      : ALL_TABS.filter((t) => t !== 'grove');

    const currentIndex = tabs.indexOf(currentTab);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= tabs.length) return;

    pendingSlideDirection = direction;

    const targetTab = tabs[targetIndex] as TabName;
    router.navigate(TAB_ROUTES[targetTab] as any);
  }, [currentTab, isGroveActive]);

  const swipeGesture = useMemo(() =>
    Gesture.Pan()
      .activeOffsetX([-SWIPE_THRESHOLD, SWIPE_THRESHOLD])
      .failOffsetY([-20, 20])
      .onEnd((event) => {
        'worklet';
        const triggered =
          Math.abs(event.translationX) > SWIPE_THRESHOLD ||
          Math.abs(event.velocityX) > VELOCITY_THRESHOLD;

        if (triggered) {
          // The tab bar itself is mirrored in RTL, so the gesture has to be too:
          // in Arabic the next tab sits to the *left*, and swiping right must
          // advance rather than go back. Transforms are never auto-flipped.
          const forward = I18nManager.isRTL ? event.translationX > 0 : event.translationX < 0;
          runOnJS(handleSwipe)(forward ? 1 : -1);
        }
      }),
    [handleSwipe]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={animatedStyle}>{children}</Animated.View>
    </GestureDetector>
  );
}
