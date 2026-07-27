import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors } from '../../../config/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

interface BottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: number;
  showHandle?: boolean;
  // When true the content sits in an internal ScrollView and a downward pull
  // past the top of that list drags the whole sheet down to dismiss (mirrors the
  // Journal TODO sheet). Leave false for short, non-scrolling content.
  scrollable?: boolean;
  // Scrollable mode only. Set false while the content is running its own drag
  // gesture (e.g. drag-to-reorder rows) — it freezes the inner ScrollView AND
  // the sheet's pull-to-dismiss pan so neither competes with that drag.
  scrollEnabled?: boolean;
  // Guard run on every user-initiated dismiss (swipe, backdrop, hardware back).
  // Return false to veto the close — the sheet snaps back open and the caller is
  // expected to drive the actual close itself (e.g. after a confirm dialog).
  beforeClose?: () => boolean;
  // Fired once the sheet is FULLY dismissed (native Modal unmounted), on both
  // gesture and programmatic closes. Use this to serialise modal hand-offs —
  // e.g. open a second sheet only after this one is gone, since iOS can't
  // present a modal over one that is still on screen or animating out.
  onClosed?: () => void;
  // Full-screen content rendered inside the sheet's Modal, above the sheet
  // itself — for nested pickers/overlays (e.g. emoji/color) that must cover the
  // whole screen without stacking a second native modal. The caller gates it.
  overlay?: ReactNode;
  // Content pinned to the bottom of the sheet, below the scroll area, so it
  // stays visible while the content scrolls (e.g. primary action buttons).
  footer?: ReactNode;
}

const DISMISS_THRESHOLD = 100;

export const BottomSheet: FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  children,
  height: heightProp,
  scrollable = false,
  scrollEnabled = true,
  beforeClose,
  onClosed,
  overlay,
  footer,
}) => {
  const { height: screenHeight } = useWindowDimensions();
  const height = heightProp ?? screenHeight * 0.8;
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const closeIconColor =
    colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary;
  const { t } = useTranslation();
  const translateY = useSharedValue(height);
  const contextY = useSharedValue(0);
  const [modalVisible, setModalVisible] = useState(false);
  const dismissedByGesture = useRef(false);

  const sheetHeight = height + insets.bottom;

  const notifyClose = useCallback(() => {
    dismissedByGesture.current = true;
    onClose();
  }, [onClose]);

  // Tear down the native Modal and notify the caller it's fully gone. Routed
  // through one helper so both the gesture and programmatic close paths fire
  // onClosed at the same point (Modal actually unmounted).
  const handleFullyClosed = useCallback(() => {
    setModalVisible(false);
    onClosed?.();
  }, [onClosed]);

  // Entrance animation. Driven off the Modal's onShow (below) rather than here,
  // because the Modal is kept always-mounted (visible toggles) — starting
  // withTiming in the same tick that flips `visible` races the native modal
  // presentation, and the reanimated view (whose mapper attached while the modal
  // window was hidden) can miss it, leaving the sheet stuck off-screen while the
  // Modal still swallows every touch. onShow fires only once the window is live.
  const handleShow = useCallback(() => {
    translateY.value = height;
    translateY.value = withTiming(0, { duration: 300 });
  }, [height, translateY]);

  useEffect(() => {
    if (isVisible) {
      dismissedByGesture.current = false;
      translateY.value = height; // park off-screen until onShow drives it up
      setModalVisible(true);
    } else if (modalVisible) {
      if (dismissedByGesture.current) {
        dismissedByGesture.current = false;
        handleFullyClosed();
      } else {
        translateY.value = withTiming(height, { duration: 250 }, (finished) => {
          if (finished) {
            runOnJS(handleFullyClosed)();
          }
        });
      }
    }
  }, [isVisible]);

  // Every user-initiated dismiss funnels through here so the beforeClose guard
  // gets a say. A veto snaps the sheet back open; otherwise it animates out.
  const requestClose = useCallback(() => {
    if (beforeClose && !beforeClose()) {
      translateY.value = withTiming(0, { duration: 200 });
      return;
    }
    translateY.value = withTiming(height, { duration: 250 }, (finished) => {
      if (finished) {
        runOnJS(notifyClose)();
      }
    });
  }, [beforeClose, translateY, height, notifyClose]);

  const panGesture = Gesture.Pan()
    .activeOffsetY(10)
    .failOffsetY(-10)
    .onStart(() => {
      contextY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.max(0, contextY.value + event.translationY);
    })
    .onEnd((event) => {
      if (translateY.value > DISMISS_THRESHOLD || event.velocityY > 500) {
        runOnJS(requestClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  // --- Scrollable mode: pull the list past its top to drag the sheet down ---
  const scrollY = useSharedValue(0);
  const listContextY = useSharedValue(0);
  const listDriving = useSharedValue(false);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY]
  );

  // Represents the inner ScrollView's own scroll gesture so the sheet pan can
  // run simultaneously with it — this is what lets a downward drag anywhere over
  // the list (not just the handle) reach the pan below.
  const scrollNativeGesture = Gesture.Native();

  const listPanGesture = Gesture.Pan()
    // Off while the content drives its own drag (see `scrollEnabled`): this pan
    // spans the whole sheet, so a downward row-drag would otherwise read as a
    // dismiss pull. Flipping `enabled` mid-gesture cancels it, which is exactly
    // what we want the moment a row drag takes over.
    .enabled(scrollEnabled)
    // Only claim deliberate downward drags — taps, the slider, the horizontal
    // tag selector, and upward scrolls all pass through to their own handlers.
    .activeOffsetY(12)
    .failOffsetY(-12)
    // Bail out the moment a drag is predominantly horizontal so swiping the
    // tag selector (or any horizontal list) never reads as a dismiss pull.
    .failOffsetX([-15, 15])
    .onUpdate((event) => {
      const atTop = scrollY.value <= 0;
      if (!listDriving.value) {
        // Only take over when the list is at its top and the pull is downward.
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
        runOnJS(requestClose)();
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

  // Always keep Modal mounted — toggling visible instead of unmounting
  // avoids iOS native modal stack flash when multiple Modals are used.
  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onShow={handleShow}
      onRequestClose={requestClose}
      statusBarTranslucent>
      <GestureHandlerRootView style={styles.flex}>
        {/* Backdrop */}
        <Animated.View className="flex-1 bg-black/50" style={backdropStyle}>
          <Pressable className="flex-1" onPress={requestClose} />
        </Animated.View>

        {/* Bottom Sheet */}
        <Animated.View
          className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-light-bg dark:bg-dark-bg"
          style={[
            {
              height: sheetHeight,
              paddingBottom: insets.bottom,
            },
            sheetStyle,
          ]}>
          {scrollable ? (
            // The pan spans the whole sheet (handle + list) so a downward drag
            // anywhere dismisses while the list is at its top; the inner list's
            // own scroll gesture runs simultaneously, so it still scrolls.
            <GestureDetector gesture={listPanGesture}>
              <View className="flex-1">
                {/* Handle */}
                <View className="items-center py-3">
                  <View className="h-[5px] w-10 rounded-full bg-gray-500" />
                </View>

                {/* Scrollable content */}
                <GestureDetector gesture={scrollNativeGesture}>
                  <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    automaticallyAdjustKeyboardInsets
                    bounces={false}
                    scrollEnabled={scrollEnabled}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingBottom: 24 }}>
                    {children}
                  </ScrollView>
                </GestureDetector>

                {/* Pinned footer (stays put while the list scrolls) */}
                {footer}
              </View>
            </GestureDetector>
          ) : (
            <GestureDetector gesture={panGesture}>
              <View className="flex-1">
                {/* Handle */}
                <View className="items-center py-3">
                  <View className="h-[5px] w-10 rounded-full bg-gray-500" />
                </View>

                {/* Content */}
                <View className="flex-1 px-6">{children}</View>

                {/* Pinned footer */}
                {footer}
              </View>
            </GestureDetector>
          )}

          {/* Accessible close button — sits above the content in the handle
              row; routes through the same guarded close path as the swipe /
              backdrop so no gesture logic changes. */}
          <Pressable
            onPress={requestClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            className="absolute right-4 top-3 h-8 w-8 items-center justify-center rounded-full bg-light-border/30 dark:bg-gray-700">
            <Ionicons name="close" size={20} color={closeIconColor} />
          </Pressable>
        </Animated.View>

        {/* Full-screen overlay above the sheet (nested pickers, etc.) */}
        {overlay}
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
