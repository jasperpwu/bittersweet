import { FC, ReactNode, useCallback, useEffect } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SheetOverlayProps {
  onClose: () => void;
  children: ReactNode;
  /** Sheet height as a fraction of screen height (default 0.6). */
  heightRatio?: number;
}

const DISMISS_THRESHOLD = 100;

/**
 * In-place bottom sheet — the same slide-up / grab-handle / drag-to-dismiss feel
 * as the shared BottomSheet (including "pull the list down past its top to
 * dismiss"), but rendered as an absolute overlay instead of a native Modal. Use
 * it for pickers that must sit on top of content already inside a presented
 * Modal (e.g. the emoji/color pickers stacked over the tag create/edit sheets)
 * without stacking a second native modal, which is unreliable on iOS. Content is
 * placed in an internal ScrollView, so pass non-scrolling children. The caller
 * gates mounting (`{visible && <SheetOverlay …/>}`).
 */
export const SheetOverlay: FC<SheetOverlayProps> = ({ onClose, children, heightRatio = 0.6 }) => {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const height = Math.round(screenHeight * heightRatio) + insets.bottom;
  const translateY = useSharedValue(height);

  // Slide up on mount.
  useEffect(() => {
    translateY.value = withTiming(0, { duration: 300 });
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateClose = useCallback(() => {
    translateY.value = withTiming(height, { duration: 250 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }, [height, onClose, translateY]);

  // --- Pull the list past its top to drag the sheet down (mirrors BottomSheet) ---
  const scrollY = useSharedValue(0);
  const listContextY = useSharedValue(0);
  const listDriving = useSharedValue(false);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY]
  );

  // Represents the inner ScrollView's own scroll gesture so the sheet pan can run
  // simultaneously with it — this is what lets a downward drag anywhere over the
  // list (not just the handle) reach the pan below.
  const scrollNativeGesture = Gesture.Native();

  const listPanGesture = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetY(-12)
    .failOffsetX([-15, 15])
    .onUpdate((event) => {
      const atTop = scrollY.value <= 0;
      if (!listDriving.value) {
        if (atTop && event.translationY > 0) {
          listDriving.value = true;
          listContextY.value = translateY.value - event.translationY;
        } else {
          return;
        }
      }
      translateY.value = Math.max(0, listContextY.value + event.translationY);
    })
    .onEnd((event) => {
      if (!listDriving.value) return;
      listDriving.value = false;
      if (translateY.value > DISMISS_THRESHOLD || event.velocityY > 500) {
        runOnJS(animateClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    })
    .onFinalize(() => {
      listDriving.value = false;
    })
    .simultaneousWithExternalGesture(scrollNativeGesture);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} className="bg-black/50">
        <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} />
      </Animated.View>

      {/* Sheet — the pan spans the whole sheet so a downward drag anywhere
          dismisses while the list is at its top; the inner list's own scroll
          gesture runs simultaneously, so it still scrolls. */}
      <GestureDetector gesture={listPanGesture}>
        <Animated.View
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-light-bg dark:bg-dark-bg"
          style={[{ height, paddingBottom: insets.bottom }, sheetStyle]}>
          {/* Handle */}
          <View className="items-center py-3">
            <View className="h-[5px] w-10 rounded-full bg-gray-500" />
          </View>

          <GestureDetector gesture={scrollNativeGesture}>
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              contentContainerStyle={{ paddingBottom: 24 }}>
              {children}
            </ScrollView>
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
};
