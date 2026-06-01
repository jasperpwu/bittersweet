import React, { useCallback, useEffect, useState } from 'react';
import { View, Image, Alert, ActivityIndicator, Pressable, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
import { Typography } from '../../src/components/ui/Typography';
import { Button } from '../../src/components/ui/Button/Button';
import { DefaultAvatar } from '../../src/components/grove/DefaultAvatar';
import { useAppStore } from '../../src/store';

const SHEET_HEIGHT = Dimensions.get('window').height * 0.42;
const DISMISS_THRESHOLD = 100;

export default function InvitePreviewModal() {
  const insets = useSafeAreaInsets();
  const pendingInvite = useAppStore((s) => s.grove.pendingInvite);
  const acceptPendingInvite = useAppStore((s) => s.grove.acceptPendingInvite);
  const clearPendingInvite = useAppStore((s) => s.grove.clearPendingInvite);
  const [isAccepting, setIsAccepting] = useState(false);

  const sheetHeight = SHEET_HEIGHT + insets.bottom;
  const translateY = useSharedValue(sheetHeight);
  const contextY = useSharedValue(0);

  const dismiss = useCallback(() => {
    clearPendingInvite();
    router.back();
  }, [clearPendingInvite]);

  const animateOut = useCallback(() => {
    translateY.value = withTiming(sheetHeight, { duration: 250 }, (finished) => {
      if (finished) {
        runOnJS(dismiss)();
      }
    });
  }, [translateY, sheetHeight, dismiss]);

  // Animate in on mount
  useEffect(() => {
    translateY.value = withTiming(0, { duration: 300 });
  }, []);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await acceptPendingInvite();
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to add friend. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

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
        translateY.value = withTiming(sheetHeight, { duration: 250 }, (finished) => {
          if (finished) {
            runOnJS(dismiss)();
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
      [0, sheetHeight],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  if (!pendingInvite) {
    return (
      <View className="flex-1">
        <Pressable className="flex-1" onPress={() => router.back()} />
      </View>
    );
  }

  const { profile, status } = pendingInvite;
  const isAlreadyFriends = status === 'already_friends';

  return (
    <GestureHandlerRootView className="flex-1">
      {/* Backdrop */}
      <Animated.View className="flex-1 bg-black/50" style={backdropStyle}>
        <Pressable className="flex-1" onPress={animateOut} />
      </Animated.View>

      {/* Sheet */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          className="absolute left-0 right-0 bottom-0 bg-light-bg dark:bg-dark-bg rounded-t-3xl"
          style={[{ height: sheetHeight, paddingBottom: insets.bottom }, sheetStyle]}
        >
          {/* Handle */}
          <View className="items-center py-3">
            <View className="w-10 h-[5px] bg-gray-500 rounded-full" />
          </View>

          {/* Content */}
          <View className="flex-1 px-6">
            {/* Profile */}
            <View className="items-center mt-2">
              {profile.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                />
              ) : (
                <DefaultAvatar
                  displayName={profile.display_name}
                  color={profile.avatar_color}
                  size={80}
                />
              )}

              <Typography variant="headline-24" color="primary" className="mt-4">
                {profile.display_name}
              </Typography>
              <Typography variant="body-14" color="secondary" className="mt-1">
                @{profile.handle}
              </Typography>
            </View>

            {/* Actions */}
            {isAlreadyFriends ? (
              <View className="mt-8 items-center">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="checkmark-circle" size={20} color="#65E9A3" />
                  <Typography variant="body-14" color="secondary">
                    Already friends with {profile.display_name}
                  </Typography>
                </View>
                <View className="mt-6 w-full">
                  <Button variant="secondary" size="large" onPress={animateOut}>
                    Dismiss
                  </Button>
                </View>
              </View>
            ) : (
              <View className="mt-8 gap-3">
                {isAccepting ? (
                  <Pressable
                    disabled
                    className="bg-primary opacity-50 px-6 py-4 min-h-14 rounded-xl items-center justify-center"
                  >
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  </Pressable>
                ) : (
                  <Button variant="primary" size="large" onPress={handleAccept}>
                    Add Friend
                  </Button>
                )}
                <Button variant="secondary" size="large" onPress={animateOut}>
                  Cancel
                </Button>
              </View>
            )}
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
