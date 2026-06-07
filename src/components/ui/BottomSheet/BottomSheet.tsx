import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
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
}

const DISMISS_THRESHOLD = 100;

export const BottomSheet: FC<BottomSheetProps> = ({
  isVisible,
  onClose,
  children,
  height: heightProp,
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

  const animateOutAndClose = useCallback(() => {
    translateY.value = withTiming(height, { duration: 250 }, (finished) => {
      if (finished) {
        runOnJS(notifyClose)();
      }
    });
  }, [translateY, height, notifyClose]);

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
      if (
        translateY.value > DISMISS_THRESHOLD ||
        event.velocityY > 500
      ) {
        translateY.value = withTiming(height, { duration: 250 }, (finished) => {
          if (finished) {
            runOnJS(notifyClose)();
          }
        });
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [0, height],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Always keep Modal mounted — toggling visible instead of unmounting
  // avoids iOS native modal stack flash when multiple Modals are used.
  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={animateOutAndClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.flex}>
        {/* Backdrop */}
        <Animated.View
          className="flex-1 bg-black/50"
          style={backdropStyle}
        >
          <Pressable
            className="flex-1"
            onPress={animateOutAndClose}
          />
        </Animated.View>

        {/* Bottom Sheet */}
        <GestureDetector gesture={panGesture}>
          <Animated.View
            className="absolute left-0 right-0 bottom-0 bg-light-bg dark:bg-dark-bg rounded-t-3xl"
            style={[
              {
                height: sheetHeight,
                paddingBottom: insets.bottom,
              },
              sheetStyle,
            ]}
          >
            {/* Handle */}
            <View className="items-center py-3">
              <View className="w-10 h-[5px] bg-gray-500 rounded-full" />
            </View>

            {/* Content */}
            <View className="flex-1 px-6">
              {children}
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
