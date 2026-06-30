import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
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
  // Guard run on every user-initiated dismiss (swipe, backdrop, hardware back).
  // Return false to veto the close — the sheet snaps back open and the caller is
  // expected to drive the actual close itself (e.g. after a confirm dialog).
  beforeClose?: () => boolean;
}

const DISMISS_THRESHOLD = 100;

export const BottomSheet: FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  children,
  height: heightProp,
  scrollable = false,
  beforeClose,
}) => {
  const { height: screenHeight } = useWindowDimensions();
  const height = heightProp ?? screenHeight * 0.8;
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(height);
  const contextY = useSharedValue(0);
  const [modalVisible, setModalVisible] = useState(false);
  const dismissedByGesture = useRef(false);

  const sheetHeight = height + insets.bottom;

  const notifyClose = useCallback(() => {
    dismissedByGesture.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isVisible) {
      dismissedByGesture.current = false;
      setModalVisible(true);
      translateY.value = height;
      translateY.value = withTiming(0, { duration: 300 });
    } else if (modalVisible) {
      if (dismissedByGesture.current) {
        setModalVisible(false);
        dismissedByGesture.current = false;
      } else {
        translateY.value = withTiming(height, { duration: 250 }, (finished) => {
          if (finished) {
            runOnJS(setModalVisible)(false);
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
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={{ paddingBottom: 24 }}>
                    {children}
                  </ScrollView>
                </GestureDetector>
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
              </View>
            </GestureDetector>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
