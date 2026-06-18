import React, { FC, useCallback } from 'react';
import { View } from 'react-native';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Typography } from '../Typography';

interface SliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  /**
   * Discrete, possibly non-uniform stops (ascending). When provided, the thumb
   * snaps to these values (evenly spaced across the track by index) and `step`
   * is ignored. `minimumValue`/`maximumValue` are still used for the end labels.
   */
  snapPoints?: number[];
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  disabled?: boolean;
  label?: string;
  unit?: string;
  width?: number;
  thumbSize?: number;
}

export const Slider: FC<SliderProps> = ({
  value,
  minimumValue,
  maximumValue,
  step = 1,
  snapPoints,
  onValueChange,
  onSlidingComplete,
  disabled = false,
  label,
  unit = '',
  width = 280,
  thumbSize: thumbSizeProp = 26,
}) => {
  const translateX = useSharedValue(0);
  const isSliding = useSharedValue(false);
  const scale = useSharedValue(1);

  const thumbSize = thumbSizeProp;
  const trackWidth = width - thumbSize; // Account for thumb size

  // Calculate initial position
  React.useEffect(() => {
    let percentage: number;
    if (snapPoints && snapPoints.length > 1) {
      // Evenly space stops by index; position thumb at the nearest stop.
      let nearest = 0;
      let bestDist = Infinity;
      for (let i = 0; i < snapPoints.length; i++) {
        const d = Math.abs(snapPoints[i] - value);
        if (d < bestDist) {
          bestDist = d;
          nearest = i;
        }
      }
      percentage = nearest / (snapPoints.length - 1);
    } else {
      const range = maximumValue - minimumValue;
      percentage = range > 0 ? (value - minimumValue) / range : 0;
    }
    translateX.value = percentage * trackWidth;
  }, [value, minimumValue, maximumValue, trackWidth, translateX, snapPoints]);

  const updateValue = useCallback((newValue: number) => {
    onValueChange(newValue);
  }, [onValueChange]);

  const completeSliding = useCallback((finalValue: number) => {
    onSlidingComplete?.(finalValue);
  }, [onSlidingComplete]);

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number }>({
    onStart: (_, context: { startX: number }) => {
      isSliding.value = true;
      scale.value = withSpring(1.2);
      context.startX = translateX.value;
    },
    onActive: (event, context: { startX: number }) => {
      const newTranslateX = Math.max(0, Math.min(trackWidth, event.translationX + context.startX));
      translateX.value = newTranslateX;

      // Calculate new value
      const percentage = trackWidth > 0 ? newTranslateX / trackWidth : 0;
      let clampedValue: number;
      if (snapPoints && snapPoints.length > 1) {
        const idx = Math.round(percentage * (snapPoints.length - 1));
        clampedValue = snapPoints[Math.max(0, Math.min(snapPoints.length - 1, idx))];
      } else {
        const rawValue = minimumValue + percentage * (maximumValue - minimumValue);
        const steppedValue = Math.round(rawValue / step) * step;
        clampedValue = Math.max(minimumValue, Math.min(maximumValue, steppedValue));
      }

      runOnJS(updateValue)(clampedValue);
    },
    onEnd: () => {
      isSliding.value = false;
      scale.value = withSpring(1);

      // Snap to final position
      const range = maximumValue - minimumValue;
      const percentage = range > 0 ? (value - minimumValue) / range : 0;
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
          <Typography variant="subtitle-14-medium" color="primary">
            {label}
          </Typography>
          <Typography variant="subtitle-14-semibold" color="primary">
            {value}{unit}
          </Typography>
        </View>
      )}

      <View style={{ width }} className="h-12 justify-center">
        <Animated.View style={[trackStyle, { justifyContent: 'center' }]}>
          {/* Track Background */}
          <View 
            className="bg-light-border dark:bg-dark-border rounded-full"
            style={{ 
              width: width, 
              height: 4,
            }} 
          />

          {/* Active Track */}
          <Animated.View
            style={[
              activeTrackStyle,
              {
                position: 'absolute',
                height: 4,
                borderRadius: 2,
                backgroundColor: '#6592E9',
              },
            ]}
          />

          {/* Thumb - outer view provides a larger 44pt hit area */}
          <PanGestureHandler onGestureEvent={gestureHandler} enabled={!disabled} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
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
