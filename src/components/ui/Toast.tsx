import React, { useEffect, useState, useCallback } from 'react';
import { View, Pressable } from 'react-native';
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
type ToastPosition = 'top' | 'bottom';

interface ToastAction {
  label: string;
  onPress: () => void;
}

interface ToastRequest {
  message: string;
  variant: ToastVariant;
  action?: ToastAction;
  durationMs: number;
  position: ToastPosition;
}

// Global listener that the rendered Toast subscribes to
let toastListener: ((request: ToastRequest) => void) | null = null;

/**
 * Show a transient toast. Pass an `action` (e.g. Undo) to render a tappable
 * button; when an action is present the toast lingers longer (default 4s) so
 * the user has time to react. Backward compatible: existing 2-arg callers keep
 * the original ~1.25s no-action behavior. Pass `position: 'bottom'` to anchor
 * the toast above the safe-area bottom instead of the default top.
 */
export function showToast(
  message: string,
  variant: ToastVariant = 'success',
  action?: ToastAction,
  durationMs?: number,
  position: ToastPosition = 'top',
) {
  toastListener?.({
    message,
    variant,
    action,
    durationMs: durationMs ?? (action ? 4000 : 1000),
    position,
  });
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

  // Animate when toast changes. The hidden offset points off-screen toward the
  // anchored edge: above the top inset (-80) or below the bottom inset (+80).
  useEffect(() => {
    if (!toast) return;

    const hiddenOffset = toast.position === 'bottom' ? 80 : -80;
    translateY.value = hiddenOffset;
    opacity.value = 0;

    translateY.value = withSequence(
      withTiming(0, { duration: 250 }),
      withDelay(toast.durationMs, withTiming(hiddenOffset, { duration: 250 }))
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withDelay(toast.durationMs, withTiming(0, { duration: 250 }, () => {
        runOnJS(clearToast)();
      }))
    );
  }, [toast]);

  const handleAction = useCallback(() => {
    const onPress = toast?.action?.onPress;
    setToast(null);
    onPress?.();
  }, [toast]);

  if (!toast) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          ...(toast.position === 'bottom'
            ? { bottom: insets.bottom + 16 }
            : { top: insets.top + 8 }),
          left: 0,
          right: 0,
          alignItems: 'center',
          zIndex: 9999,
        },
        animatedStyle,
      ]}
    >
      <View className={`${variantClasses[toast.variant]} px-5 py-3 rounded-2xl shadow-lg flex-row items-center`}>
        <Typography variant="body-14" color="white">
          {toast.message}
        </Typography>
        {toast.action && (
          <Pressable onPress={handleAction} className="ml-4 active:opacity-70" hitSlop={8}>
            <Typography variant="subtitle-16" color="white">
              {toast.action.label}
            </Typography>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
};
