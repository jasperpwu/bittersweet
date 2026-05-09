import React, { useEffect, useState, useCallback } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { Typography } from './Typography';

type ToastVariant = 'success' | 'neutral' | 'error';

interface ToastRequest {
  message: string;
  variant: ToastVariant;
}

// Global listener that the rendered Toast subscribes to
let toastListener: ((request: ToastRequest) => void) | null = null;

export function showToast(message: string, variant: ToastVariant = 'success') {
  toastListener?.({ message, variant });
}

const variantClasses: Record<ToastVariant, string> = {
  success: 'bg-green-600',
  neutral: 'bg-gray-700',
  error: 'bg-red-600',
};

export const Toast: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastRequest | null>(null);
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const clearToast = useCallback(() => {
    setToast(null);
  }, []);

  const handleToast = useCallback((request: ToastRequest) => {
    setToast(request);
  }, []);

  // Register global listener
  useEffect(() => {
    toastListener = handleToast;
    return () => { toastListener = null; };
  }, [handleToast]);

  // Animate when toast changes
  useEffect(() => {
    if (!toast) return;

    translateY.value = -80;
    opacity.value = 0;

    translateY.value = withSequence(
      withTiming(0, { duration: 250 }),
      withDelay(1000, withTiming(-80, { duration: 250 }))
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withDelay(1000, withTiming(0, { duration: 250 }, () => {
        runOnJS(clearToast)();
      }))
    );
  }, [toast]);

  if (!toast) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: insets.top + 8,
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 9999,
        },
        animatedStyle,
      ]}
    >
      <View className={`${variantClasses[toast.variant]} px-5 py-3 rounded-2xl shadow-lg`}>
        <Typography variant="body-14" color="white">
          {toast.message}
        </Typography>
      </View>
    </Animated.View>
  );
};
