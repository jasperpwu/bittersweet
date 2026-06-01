import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

interface HeartbeatIndicatorProps {
  isPaused: boolean;
  hasUnreadAlerts: boolean;
  onPress: () => void;
}

export const HeartbeatIndicator: React.FC<HeartbeatIndicatorProps> = ({
  isPaused,
  hasUnreadAlerts,
  onPress,
}) => {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isPaused) {
      cancelAnimation(scale);
      scale.value = withTiming(1);
    } else {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 400, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 400, easing: Easing.in(Easing.ease) }),
          withTiming(1, { duration: 800 })
        ),
        -1
      );
    }
  }, [isPaused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable onPress={onPress} hitSlop={8} className="active:opacity-60">
      <View>
        <Animated.View style={animatedStyle}>
          <Ionicons
            name={isPaused ? 'heart-outline' : 'heart'}
            size={22}
            color={isPaused ? '#8B8B8B' : '#FF6B6B'}
          />
        </Animated.View>
        {hasUnreadAlerts && (
          <View className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#FF6B6B] border border-light-bg dark:border-dark-bg" />
        )}
      </View>
    </Pressable>
  );
};
