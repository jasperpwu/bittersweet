import React, { FC, useCallback } from 'react';
import { View } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Typography } from '../Typography';

interface SliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  disabled?: boolean;
  label?: string;
  unit?: string;
  width?: number;
}

export const Slider: FC<SliderProps> = ({
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  onSlidingComplete,
  disabled = false,
  label,
  unit = '',
  width = 280,
}) => {
  const translateX = useSharedValue(0);
  const isSliding = useSharedValue(false);
  const scale = useSharedValue(1);

  const trackWidth = width - 24; // Account for thumb size
  const thumbSize = 24;

  // Calculate initial position
  React.useEffect(() => {
    const percentage = (value - minimumValue) / (maximumValue - minimumValue);
    translateX.value = percentage * trackWidth;
  }, [value, minimumValue, maximumValue, trackWidth]);

  const updateValue = useCallback((newValue: number) => {
    onValueChange(newValue);
  }, [onValueChange]);

  const completeSliding = useCallback((finalValue: number) => {
    onSlidingComplete?.(finalValue);
  }, [onSlidingComplete]);

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: () => {
      isSliding.value = true;
      scale.value = withSpring(1.2);
    },
    onActive: (event) => {
      const newTranslateX = Math.max(0, Math.min(trackWidth, event.translationX + translateX.value));
      translateX.value = newTranslateX;

      // Calculate new value
      const percentage = newTranslateX / trackWidth;
      const rawValue = minimumValue + percentage * (maximumValue - minimumValue);
      const steppedValue = Math.round(rawValue / step) * step;
      const clampedValue = Math.max(minimumValue, Math.min(maximumValue, steppedValue));

      runOnJS(updateValue)(clampedValue);
    },
    onEnd: () => {
      isSliding.value = false;
      scale.value = withSpring(1);

      // Snap to final position
      const percentage = (value - minimumValue) / (maximumValue - minimumValue);
      translateX.value = withSpring(percentage * trackWidth);

      runOnJS(completeSliding)(value);
    },
  });

  const trackStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.5 : 1,
  }));

  const activeTrackStyle = useAnimatedStyle(() => ({
    width: translateX.value + thumbSize / 2,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View className="items-center">
      {label && (
        <View className="flex-row items-center justify-between w-full mb-2">
          <Typography variant="subtitle-14-medium" color="white">
            {label}
          </Typography>
          <Typography variant="subtitle-14-semibold" color="primary">
            {value}{unit}
          </Typography>
        </View>
      )}

      <View style={{ width }} className="h-12 justify-center">
        <Animated.View style={trackStyle}>
          {/* Track Background */}
          <View 
            className="bg-dark-border rounded-full"
            style={{ 
              width: trackWidth + thumbSize, 
              height: 4,
              marginHorizontal: thumbSize / 2,
            }} 
          />

          {/* Active Track */}
          <Animated.View
            style={[
              activeTrackStyle,
              {
                position: 'absolute',
                height: 4,
                marginLeft: thumbSize / 2,
                borderRadius: 2,
                backgroundColor: '#6592E9',
              },
            ]}
          />

          {/* Thumb */}
          <PanGestureHandler onGestureEvent={gestureHandler} enabled={!disabled}>
            <Animated.View
              style={[
                thumbStyle,
                {
                  position: 'absolute',
                  width: thumbSize,
                  height: thumbSize,
                  borderRadius: thumbSize / 2,
                  backgroundColor: '#FFFFFF',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                },
              ]}
            />
          </PanGestureHandler>
        </Animated.View>
      </View>

      {/* Value Labels */}
      <View className="flex-row justify-between w-full mt-2">
        <Typography variant="body-12" color="secondary">
          {minimumValue}{unit}
        </Typography>
        <Typography variant="body-12" color="secondary">
          {maximumValue}{unit}
        </Typography>
      </View>
    </View>
  );
};