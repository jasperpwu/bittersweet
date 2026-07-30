import React, { useEffect, useState, RefObject } from 'react';
import { View, Pressable, useColorScheme, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../../../config/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Typography } from '../Typography';

interface CoachMarkProps {
  targetRef: RefObject<View | null>;
  title: string;
  /** Single-paragraph body. Omit when using `steps`. */
  message?: string;
  /** Numbered walkthrough points, rendered under `message` (or on their own). */
  steps?: string[];
  /** Overrides the default "Got it" dismiss label. */
  dismissLabel?: string;
  onDismiss: () => void;
  visible: boolean;
}

interface TargetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PADDING = 8;
const TOOLTIP_MARGIN = 12;

export const CoachMark: React.FC<CoachMarkProps> = ({
  targetRef,
  title,
  message,
  steps,
  dismissLabel,
  onDismiss,
  visible,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const opacity = useSharedValue(0);
  const [targetLayout, setTargetLayout] = useState<TargetLayout | null>(null);
  const [tooltipBelow, setTooltipBelow] = useState(true);

  useEffect(() => {
    if (visible && targetRef.current) {
      // Measure the target element position on screen
      targetRef.current.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) {
          setTargetLayout({ x, y, width, height });
          // Show tooltip below if target is in upper half, above if in lower half
          setTooltipBelow(y + height / 2 < SCREEN_HEIGHT / 2);
          opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
        }
      });
    } else if (!visible) {
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
    }
  }, [visible, targetRef]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible || !targetLayout) return null;

  const cutout = {
    top: targetLayout.y - PADDING,
    left: targetLayout.x - PADDING,
    width: targetLayout.width + PADDING * 2,
    height: targetLayout.height + PADDING * 2,
  };

  const tooltipTop = tooltipBelow
    ? cutout.top + cutout.height + TOOLTIP_MARGIN
    : cutout.top - TOOLTIP_MARGIN;

  const arrowTop = tooltipBelow ? -8 : undefined;
  const arrowBottom = tooltipBelow ? undefined : -8;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { zIndex: 9999 }, overlayStyle]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Backdrop — four rectangles around the cutout */}
      <View style={[StyleSheet.absoluteFill]}>
        {/* Top */}
        <View style={[styles.backdrop, { top: 0, left: 0, right: 0, height: cutout.top }]} />
        {/* Left */}
        <View
          style={[
            styles.backdrop,
            { top: cutout.top, left: 0, width: cutout.left, height: cutout.height },
          ]}
        />
        {/* Right */}
        <View
          style={[
            styles.backdrop,
            {
              top: cutout.top,
              left: cutout.left + cutout.width,
              right: 0,
              height: cutout.height,
            },
          ]}
        />
        {/* Bottom */}
        <View
          style={[
            styles.backdrop,
            { top: cutout.top + cutout.height, left: 0, right: 0, bottom: 0 },
          ]}
        />
      </View>

      {/* Cutout highlight border */}
      <View
        style={{
          position: 'absolute',
          top: cutout.top,
          left: cutout.left,
          width: cutout.width,
          height: cutout.height,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.primary,
        }}
      />

      {/* Tooltip */}
      <View
        style={[
          styles.tooltip,
          {
            top: tooltipBelow ? tooltipTop : undefined,
            bottom: tooltipBelow ? undefined : SCREEN_HEIGHT - tooltipTop,
            left: 24,
            right: 24,
            backgroundColor: isDark ? colors.dark.card : colors.white,
          },
        ]}
      >
        {/* Arrow */}
        <View
          style={[
            styles.arrow,
            {
              top: arrowTop,
              bottom: arrowBottom,
              left: Math.min(
                Math.max(cutout.left + cutout.width / 2 - 24 - 8, 16),
                SCREEN_WIDTH - 24 * 2 - 32
              ),
              borderBottomColor: tooltipBelow ? (isDark ? colors.dark.card : colors.white) : 'transparent',
              borderTopColor: !tooltipBelow ? (isDark ? colors.dark.card : colors.white) : 'transparent',
              transform: tooltipBelow ? [] : [{ rotate: '180deg' }],
            },
          ]}
        />

        <Typography variant="subtitle-14-semibold" color="primary" className="mb-1">
          {title}
        </Typography>
        {!!message && (
          <Typography variant="body-14" color="secondary" className="mb-4">
            {message}
          </Typography>
        )}
        {!!steps?.length && (
          <View className="mb-4" style={{ gap: 10 }}>
            {steps.map((step, index) => (
              <View key={index} className="flex-row" style={{ gap: 10 }}>
                <View
                  className="h-5 w-5 items-center justify-center rounded-full bg-primary-soft"
                  style={{ marginTop: 1 }}>
                  <Typography variant="body-12" className="text-primary">
                    {index + 1}
                  </Typography>
                </View>
                <Typography variant="body-14" color="secondary" className="flex-1">
                  {step}
                </Typography>
              </View>
            ))}
          </View>
        )}
        <Pressable
          onPress={onDismiss}
          className="bg-primary rounded-xl py-2.5 items-center active:opacity-80"
        >
          <Typography variant="subtitle-14-medium" className="text-white">
            {dismissLabel ?? 'Got it'}
          </Typography>
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  tooltip: {
    position: 'absolute',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
