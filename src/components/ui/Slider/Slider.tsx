import React, { FC, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Typography } from '../Typography';
import { DEFAULT_SLIDER_COLORS } from '../../../config/sliderThemes';
import { useSliderTheme } from '../../../hooks/useSliderTheme';

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

  // Fruit-store slider theme: stripes the active track with the theme's colors
  // and swaps the thumb for its emoji (e.g. a soccer ball). Null = classic look.
  const sliderTheme = useSliderTheme();

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

  const updateValue = useCallback(
    (newValue: number) => {
      onValueChange(newValue);
    },
    [onValueChange]
  );

  const completeSliding = useCallback(
    (finalValue: number) => {
      onSlidingComplete?.(finalValue);
    },
    [onSlidingComplete]
  );

  // Map an absolute finger X (relative to the track) → the snapped/stepped value.
  const valueFromTranslate = useCallback(
    (tx: number) => {
      'worklet';
      const percentage = trackWidth > 0 ? tx / trackWidth : 0;
      if (snapPoints && snapPoints.length > 1) {
        const idx = Math.round(percentage * (snapPoints.length - 1));
        return snapPoints[Math.max(0, Math.min(snapPoints.length - 1, idx))];
      }
      const rawValue = minimumValue + percentage * (maximumValue - minimumValue);
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(minimumValue, Math.min(maximumValue, steppedValue));
    },
    [trackWidth, snapPoints, minimumValue, maximumValue, step]
  );

  // The gesture spans the whole track, so `event.x` is the finger position along
  // the full width. Center the thumb under the finger and clamp to the track.
  // `activeOffsetX` claims only horizontal drags so a parent ScrollView can still
  // scroll vertically.
  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-8, 8])
    .onStart((event) => {
      isSliding.value = true;
      scale.value = withSpring(1.2);
      const newTranslateX = Math.max(0, Math.min(trackWidth, event.x - thumbSize / 2));
      translateX.value = newTranslateX;
      runOnJS(updateValue)(valueFromTranslate(newTranslateX));
    })
    .onUpdate((event) => {
      const newTranslateX = Math.max(0, Math.min(trackWidth, event.x - thumbSize / 2));
      translateX.value = newTranslateX;
      runOnJS(updateValue)(valueFromTranslate(newTranslateX));
    })
    // onFinalize, not onEnd: a touch that begins on the track but is then
    // cancelled or fails — e.g. a parent horizontal pager wins the same drag —
    // must still settle the thumb and fire onSlidingComplete, or any caller that
    // disabled something for the duration of the drag would stay stuck.
    // onFinalize runs whether or not the gesture ever activated; onEnd does not.
    .onFinalize(() => {
      isSliding.value = false;
      scale.value = withSpring(1);

      // Snap to final position
      const range = maximumValue - minimumValue;
      const percentage = range > 0 ? (value - minimumValue) / range : 0;
      translateX.value = withSpring(percentage * trackWidth);

      runOnJS(completeSliding)(value);
    });

  const trackStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.5 : 1,
  }));

  const activeTrackStyle = useAnimatedStyle(() => ({
    width: translateX.value + thumbSize / 2,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scale.value }],
  }));

  return (
    <View className="items-center">
      {label && (
        <View className="mb-2 w-full flex-row items-center justify-between">
          <Typography variant="subtitle-14-medium" color="primary">
            {label}
          </Typography>
          <Typography variant="subtitle-14-semibold" color="primary">
            {value}
            {unit}
          </Typography>
        </View>
      )}

      {/* The whole track is one large touch target — start a horizontal drag
          anywhere along the full width to move the thumb, not just on the thumb
          itself. */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[trackStyle, { width, justifyContent: 'center' }]} className="h-14">
          {/* Track Background */}
          <View
            className="rounded-full bg-light-border dark:bg-dark-border"
            style={{
              width: width,
              height: 4,
            }}
          />

          {/* Active Track — themed: fixed full-width stripes clipped by the animated width */}
          <Animated.View
            style={[
              activeTrackStyle,
              {
                position: 'absolute',
                height: 4,
                borderRadius: 2,
                overflow: 'hidden',
                backgroundColor: sliderTheme ? undefined : DEFAULT_SLIDER_COLORS.activeTrack,
              },
            ]}>
            {sliderTheme && (
              <View style={{ flexDirection: 'row', width, height: 4 }}>
                {sliderTheme.trackColors.map((color, i) => (
                  <View key={i} style={{ flex: 1, backgroundColor: color }} />
                ))}
              </View>
            )}
          </Animated.View>

          {/* Thumb — visual only; the gesture lives on the whole track above */}
          <Animated.View
            pointerEvents="none"
            style={[
              thumbStyle,
              {
                position: 'absolute',
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: sliderTheme ? 'transparent' : DEFAULT_SLIDER_COLORS.thumb,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: sliderTheme ? 0 : 0.3,
                shadowRadius: 4,
                elevation: sliderTheme ? 0 : 5,
              },
            ]}>
            {sliderTheme && (
              <Text
                allowFontScaling={false}
                style={{ fontSize: thumbSize - 4, lineHeight: thumbSize }}>
                {sliderTheme.thumbEmoji}
              </Text>
            )}
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Value Labels */}
      <View className="mt-2 w-full flex-row justify-between">
        <Typography variant="body-12" color="secondary">
          {minimumValue}
          {unit}
        </Typography>
        <Typography variant="body-12" color="secondary">
          {maximumValue}
          {unit}
        </Typography>
      </View>
    </View>
  );
};
