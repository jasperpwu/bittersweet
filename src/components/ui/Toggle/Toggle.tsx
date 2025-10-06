import React, { FC, useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
  accessibilityLabel?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Toggle: FC<ToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  size = 'medium',
  accessibilityLabel,
}) => {
  const translateX = useSharedValue(value ? 1 : 0);
  const backgroundProgress = useSharedValue(value ? 1 : 0);
  const scale = useSharedValue(1);

  const dimensions = size === 'small' 
    ? { width: 44, height: 24, thumbSize: 20, padding: 2 }
    : { width: 52, height: 28, thumbSize: 24, padding: 2 };

  useEffect(() => {
    translateX.value = withSpring(value ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
    backgroundProgress.value = withTiming(value ? 1 : 0, { duration: 200 });
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      backgroundProgress.value,
      [0, 1],
      ['#575757', '#6592E9'] // dark-border to primary
    ),
    transform: [{ scale: scale.value }],
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: translateX.value * (dimensions.width - dimensions.thumbSize - dimensions.padding * 2),
      },
    ],
  }));

  const handlePress = () => {
    if (!disabled) {
      onValueChange(!value);
    }
  };

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.95);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1);
    }
  };

  return (
    <AnimatedPressable
      style={[
        trackStyle,
        {
          width: dimensions.width,
          height: dimensions.height,
          borderRadius: dimensions.height / 2,
          padding: dimensions.padding,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
    >
      <Animated.View
        style={[
          thumbStyle,
          {
            width: dimensions.thumbSize,
            height: dimensions.thumbSize,
            borderRadius: dimensions.thumbSize / 2,
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3,
          },
        ]}
      />
    </AnimatedPressable>
  );
};