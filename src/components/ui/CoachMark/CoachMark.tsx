import React, { useEffect, useState, useCallback, RefObject } from 'react';
import { View, Pressable, useColorScheme, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../../../config/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Typography } from '../Typography';

/** One stop in a walkthrough: its own copy and its own spotlight target. */
export interface CoachMarkStep {
  targetRef: RefObject<View | null>;
  title: string;
  message: string;
}

interface CoachMarkProps {
  /**
   * Single-spotlight target. In walkthrough mode (`steps`) this doubles as the
   * fallback target for a step whose own element isn't on screen — conditional
   * UI (an empty-state placeholder, a collapsed section) may not be mounted.
   */
  targetRef: RefObject<View | null>;
  /** Single-spotlight copy. Omit when using `steps`. */
  title?: string;
  message?: string;
  /** Walkthrough: one spotlight per step, advanced with the footer button. */
  steps?: CoachMarkStep[];
  /**
   * Fires with each step index just before that step is measured, so the host
   * can scroll the upcoming target into view. Pair with `stepDelay`.
   */
  onStepChange?: (index: number) => void;
  /** ms to wait after `onStepChange` before measuring — lets a scroll settle. */
  stepDelay?: number;
  /** Overrides the default "Next" label on non-final steps. */
  nextLabel?: string;
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
// Keep the tooltip clear of the status bar and the tab bar when it has to be
// clamped (a target taller than the free space either side of it).
const EDGE_MARGIN_TOP = 60;
const EDGE_MARGIN_BOTTOM = 100;

export const CoachMark: React.FC<CoachMarkProps> = ({
  targetRef,
  title,
  message,
  steps,
  onStepChange,
  stepDelay = 0,
  nextLabel,
  dismissLabel,
  onDismiss,
  visible,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const opacity = useSharedValue(0);
  const [targetLayout, setTargetLayout] = useState<TargetLayout | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const isWalkthrough = !!steps?.length;
  const safeIndex = isWalkthrough ? Math.min(stepIndex, steps!.length - 1) : 0;
  const current = isWalkthrough ? steps![safeIndex] : { targetRef, title, message };
  const isLastStep = !isWalkthrough || safeIndex === steps!.length - 1;

  // Restart the walkthrough each time the overlay is shown.
  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) });
      return;
    }

    onStepChange?.(safeIndex);

    // The previous spotlight stays put until the new one measures, so advancing
    // a step never flashes an empty backdrop.
    const apply = (x: number, y: number, width: number, height: number) => {
      setTargetLayout({ x, y, width, height });
      opacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.ease) });
    };
    const measure = (ref: RefObject<View | null> | undefined, onFail: () => void) => {
      const node = ref?.current;
      if (!node) return onFail();
      node.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) apply(x, y, width, height);
        else onFail();
      });
    };

    const timer = setTimeout(
      () =>
        measure(current.targetRef, () => {
          // Step target isn't mounted (conditional UI) — fall back to the
          // screen-level anchor so the step still has somewhere to point.
          if (current.targetRef !== targetRef) measure(targetRef, () => {});
        }),
      safeIndex === 0 ? 0 : stepDelay
    );
    return () => clearTimeout(timer);
  }, [visible, safeIndex]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleAdvance = useCallback(() => {
    if (isLastStep) onDismiss();
    else setStepIndex((i) => i + 1);
  }, [isLastStep, onDismiss]);

  if (!visible || !targetLayout) return null;

  const cutout = {
    top: targetLayout.y - PADDING,
    left: targetLayout.x - PADDING,
    width: targetLayout.width + PADDING * 2,
    height: targetLayout.height + PADDING * 2,
  };

  // Place the tooltip on whichever side of the spotlight actually fits it. A
  // tall target (a full-height timeline) may fit neither, so clamp it on screen
  // and drop the arrow — an arrow pointing at nothing reads worse than none.
  const height = tooltipHeight || 180;
  const spaceBelow =
    SCREEN_HEIGHT - (cutout.top + cutout.height) - TOOLTIP_MARGIN - EDGE_MARGIN_BOTTOM;
  const spaceAbove = cutout.top - TOOLTIP_MARGIN - EDGE_MARGIN_TOP;
  const tooltipBelow =
    spaceBelow >= height ? true : spaceAbove >= height ? false : spaceBelow >= spaceAbove;
  const preferredTop = tooltipBelow
    ? cutout.top + cutout.height + TOOLTIP_MARGIN
    : cutout.top - TOOLTIP_MARGIN - height;
  const tooltipTop = Math.min(
    Math.max(preferredTop, EDGE_MARGIN_TOP),
    SCREEN_HEIGHT - EDGE_MARGIN_BOTTOM - height
  );
  const showArrow = Math.abs(tooltipTop - preferredTop) < 1;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { zIndex: 9999 }, overlayStyle]}
      pointerEvents={visible ? 'auto' : 'none'}>
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
        onLayout={(e) => setTooltipHeight(e.nativeEvent.layout.height)}
        style={[
          styles.tooltip,
          {
            top: tooltipTop,
            left: 24,
            right: 24,
            backgroundColor: isDark ? colors.dark.card : colors.white,
            // Hold it invisible for the first frame, before its height is known
            // and the placement above is still working off the estimate.
            opacity: tooltipHeight ? 1 : 0,
          },
        ]}>
        {/* Arrow */}
        {showArrow && (
          <View
            style={[
              styles.arrow,
              {
                top: tooltipBelow ? -8 : undefined,
                bottom: tooltipBelow ? undefined : -8,
                left: Math.min(
                  Math.max(cutout.left + cutout.width / 2 - 24 - 8, 16),
                  SCREEN_WIDTH - 24 * 2 - 32
                ),
                borderBottomColor: tooltipBelow
                  ? isDark
                    ? colors.dark.card
                    : colors.white
                  : 'transparent',
                borderTopColor: !tooltipBelow
                  ? isDark
                    ? colors.dark.card
                    : colors.white
                  : 'transparent',
                transform: tooltipBelow ? [] : [{ rotate: '180deg' }],
              },
            ]}
          />
        )}

        <Typography variant="subtitle-14-semibold" color="primary" className="mb-1">
          {current.title}
        </Typography>
        {!!current.message && (
          <Typography variant="body-14" color="secondary" className="mb-4">
            {current.message}
          </Typography>
        )}

        {/* Progress dots — only meaningful for a multi-stop walkthrough */}
        {isWalkthrough && steps!.length > 1 && (
          <View className="mb-3 flex-row" style={{ gap: 6 }}>
            {steps!.map((_, index) => (
              <View
                key={index}
                className={`h-1.5 rounded-full ${index === safeIndex ? 'bg-primary' : 'bg-primary-soft'}`}
                style={{ width: index === safeIndex ? 16 : 6 }}
              />
            ))}
          </View>
        )}

        <Pressable
          onPress={handleAdvance}
          className="items-center rounded-xl bg-primary py-2.5 active:opacity-80">
          <Typography variant="subtitle-14-medium" className="text-white">
            {isLastStep ? (dismissLabel ?? 'Got it') : (nextLabel ?? 'Next')}
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
    shadowRadius: 8,
    shadowOpacity: 0.2,
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
