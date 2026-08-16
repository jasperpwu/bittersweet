import { FC, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  useColorScheme,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { colors } from '../../../config/theme';
import * as Haptics from 'expo-haptics';

interface TimeScrollerProps {
  selectedTime: number;
  onTimeChange: (time: number) => void;
}

const TICK_SPACING = 100;

// Graduated time values up to 8 hours:
// 5-min steps: 0–60, 15-min steps: 75–120, 30-min steps: 150–240, 60-min steps: 300–480
const BASE_TIME_VALUES = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
  75, 90, 105, 120,
  150, 180, 210, 240,
  300, 360, 420, 480,
];

// -1 / -2 are dev-only sentinels for "5 seconds" / "10 seconds" test modes
const TIME_VALUES = __DEV__
  ? [-1, -2, ...BASE_TIME_VALUES]
  : BASE_TIME_VALUES;

/** Format minutes for display: values < 60 show as number, >= 60 show as e.g. 1h, 1h15, 2h30 */
const formatTickLabel = (minutes: number): string => {
  if (minutes === -1) return '5s';
  if (minutes === -2) return '10s';
  if (minutes === 0) return '\u221E'; // ∞
  if (minutes < 60) return String(minutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
};

/**
 * Index of the tick that best represents `time`.
 *
 * Durations regularly arrive off this coarse grid — a goal row's remaining
 * minutes, a TODO's duration, a recovered session's target, or a value the
 * wheel-style picker allowed. A plain indexOf returns -1 for those, which used
 * to park the scroller on the first tick (∞) while the real duration stayed
 * whatever it was, so "start focus" ran a countdown the scale never showed.
 * Falling back to the nearest tick keeps the scale honest; the caller commits
 * that value so state and display can't diverge.
 */
const nearestTickIndex = (time: number): number => {
  const exact = TIME_VALUES.indexOf(time);
  if (exact >= 0) return exact;
  let bestIndex = 0;
  let bestDistance = Infinity;
  TIME_VALUES.forEach((value, index) => {
    if (value < 0) return; // never auto-snap onto the dev-only second timers
    const distance = Math.abs(value - time);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
};

const FONT_BOLD = 'Poppins-Bold';

/**
 * Animated tick item that reacts to scroll position for smooth scale/opacity transitions.
 *
 * Driven by a Reanimated shared value rather than `Animated.Value` +
 * `Animated.event({useNativeDriver: true})`: as of SDK 57 (RN 0.86) RN's
 * native-driven scroll events never reach the animated graph, so every tick
 * stayed frozen at its mount-time scale/opacity while the list scrolled under
 * it — the pointer ended up highlighting a different tick than the one it
 * pointed at. Reanimated runs the same interpolation on the UI thread.
 */
const TickItem: FC<{
  time: number;
  index: number;
  scrollX: SharedValue<number>;
  textColor: string;
  minorTickColor: string;
  majorTickColor: string;
}> = ({ time, index, scrollX, textColor, minorTickColor, majorTickColor }) => {
  const itemCenter = index * TICK_SPACING; // scroll position when this item is centered

  const textStyle = useAnimatedStyle(() => {
    // Distance from center in scroll coordinates
    const inputRange = [
      itemCenter - TICK_SPACING * 3,
      itemCenter - TICK_SPACING * 2,
      itemCenter - TICK_SPACING,
      itemCenter,
      itemCenter + TICK_SPACING,
      itemCenter + TICK_SPACING * 2,
      itemCenter + TICK_SPACING * 3,
    ];
    return {
      opacity: interpolate(
        scrollX.value,
        inputRange,
        [0.2, 0.35, 0.6, 1, 0.6, 0.35, 0.2],
        Extrapolation.CLAMP
      ),
      transform: [
        {
          scale: interpolate(
            scrollX.value,
            inputRange,
            [0.42, 0.5, 0.62, 1, 0.62, 0.5, 0.42],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  // Tick height: hide when centered (selected), show otherwise
  const tickStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [itemCenter - TICK_SPACING * 0.5, itemCenter, itemCenter + TICK_SPACING * 0.5],
      [0.4, 0, 0.4],
      Extrapolation.CLAMP
    ),
  }));

  return (
    <View
      style={{
        width: TICK_SPACING,
        height: 110,
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <View style={{ height: 80, justifyContent: 'center', width: TICK_SPACING }}>
        <Reanimated.Text
          style={[
            {
              color: textColor,
              fontSize: time >= 60 ? 36 : 56,
              fontFamily: FONT_BOLD,
              textAlign: 'center',
              paddingBottom: 100,
            },
            textStyle,
          ]}
        >
          {formatTickLabel(time)}
        </Reanimated.Text>
      </View>

      {/* Minor ticks inside the segment */}
      <View
        style={{ position: 'absolute', bottom: 20, left: 0, right: 0, height: 20 }}
        pointerEvents="none"
      >
        {[1, 2, 3, 4].map((j) => {
          const left = (TICK_SPACING / 5) * j;
          return (
            <View
              key={`minor-${j}`}
              style={{
                position: 'absolute',
                left: left - 1,
                width: 2,
                height: 10,
                backgroundColor: minorTickColor,
                borderRadius: 1,
              }}
            />
          );
        })}
      </View>

      {/* Major tick */}
      <Reanimated.View
        style={[
          {
            width: 3,
            height: 24,
            backgroundColor: majorTickColor,
            borderRadius: 1.5,
          },
          tickStyle,
        ]}
      />
    </View>
  );
};

export const TimeScroller: FC<TimeScrollerProps> = ({
  selectedTime,
  onTimeChange,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const centerPosition = screenWidth / 2;
  const centerOffset = (screenWidth - TICK_SPACING) / 2;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary;
  const minorTickColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(93,78,55,0.25)';
  const majorTickColor = isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary;
  const indicatorColor = isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary;
  const scrollViewRef = useRef<ScrollView | null>(null);
  const isUserScrollingRef = useRef(false);
  const lastSnappedRef = useRef(selectedTime);
  // Fed from the plain `onScroll` prop below, NOT from a native-driven animated
  // event. On this RN version every by-view-tag scroll registration we tried
  // silently received nothing on iOS — RN's own `Animated.event` native driver,
  // Reanimated's `useAnimatedScrollHandler`, and `useScrollOffset` alike. The
  // JS `onScroll` prop is the one path measured to fire reliably here, so the
  // offset is sampled there and only the interpolation runs on the UI thread.
  const scrollX = useSharedValue(nearestTickIndex(selectedTime) * TICK_SPACING);

  useEffect(() => {
    if (isUserScrollingRef.current) return;
    const tickIndex = nearestTickIndex(selectedTime);
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: tickIndex * TICK_SPACING, animated: false });
    }
    // Keep the animated position in step with the jump we just made. A
    // programmatic scrollTo does emit a scroll event, but setting it here means
    // the ticks are correct on the very first frame rather than one event later.
    scrollX.value = tickIndex * TICK_SPACING;
    // The incoming value has no tick of its own — adopt the tick we just centered
    // as the real duration so the number under the indicator is the one that runs.
    const tickTime = TIME_VALUES[tickIndex];
    if (tickTime !== selectedTime) {
      lastSnappedRef.current = tickTime;
      onTimeChange(tickTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTime]);

  // Drives the tick highlight, and fires a haptic on each snap boundary.
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;

    // Only track while the user drives the scroll — a late event arriving after
    // settle would otherwise write back a stale offset. The selectedTime effect
    // sets scrollX for every programmatic jump.
    if (!isUserScrollingRef.current) return;
    scrollX.value = x;
    const snappedIndex = Math.max(
      0,
      Math.min(TIME_VALUES.length - 1, Math.round(x / TICK_SPACING))
    );
    const snappedTime = TIME_VALUES[snappedIndex];
    if (snappedTime !== lastSnappedRef.current) {
      lastSnappedRef.current = snappedTime;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleScrollBeginDrag = () => {
    isUserScrollingRef.current = true;
  };

  // Commit whatever tick the scroller came to rest on.
  const settleAt = (scrollXVal: number) => {
    const snappedIndex = Math.round(scrollXVal / TICK_SPACING);
    const clampedIndex = Math.max(0, Math.min(TIME_VALUES.length - 1, snappedIndex));
    const snappedTime = TIME_VALUES[clampedIndex];

    if (snappedTime !== selectedTime) {
      onTimeChange(snappedTime);
    }

    lastSnappedRef.current = snappedTime;
    isUserScrollingRef.current = false;
  };

  const handleMomentumScrollEnd = (event: any) => {
    // Only handle user-initiated scrolls (started with onScrollBeginDrag).
    // Animated programmatic scrolls and initial layout snaps also fire this event
    // (RCTScrollView sends onMomentumScrollEnd from scrollViewDidEndScrollingAnimation
    // too), which would incorrectly overwrite the persisted duration.
    if (!isUserScrollingRef.current) return;
    settleAt(event.nativeEvent.contentOffset.x);
  };

  // A slow release with no fling never decelerates, and onMomentumScrollEnd is
  // only sent from scrollViewDidEndDecelerating — so without this the value is
  // never committed AND isUserScrollingRef stays true forever, permanently
  // disabling the sync effect above. That's how the scale ends up resting on one
  // tick while "start focus" runs the previously selected duration. Skip when
  // there's real velocity: momentum will follow and commit the final tick, and
  // settling now would also let the sync effect fight the native snap (jiggle).
  const handleScrollEndDrag = (event: any) => {
    const velocityX = event.nativeEvent.velocity?.x ?? 0;
    if (Math.abs(velocityX) < 0.05) {
      settleAt(event.nativeEvent.contentOffset.x);
    }
  };

  return (
    <View style={{ height: 140 }}>
      <View style={{ height: 110, position: 'relative' }}>
        {/* Fixed center indicator line */}
        <View
          style={{
            position: 'absolute',
            left: centerPosition - 3,
            top: 58,
            width: 6,
            height: 40,
            backgroundColor: indicatorColor,
            borderRadius: 3,
            zIndex: 10,
          }}
        />
        <Reanimated.ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={handleScroll}
          // 1, not 16: this handler is what feeds the tick highlight, so the
          // sampling rate IS the animation's frame rate. 16ms caps it at ~60/s,
          // which is half the scroll's own rate on a 120Hz ProMotion display.
          scrollEventThrottle={1}
          decelerationRate="fast"
          snapToInterval={TICK_SPACING}
          snapToAlignment="start"
          contentContainerStyle={{
            paddingHorizontal: centerOffset,
          }}
        >
          {TIME_VALUES.map((time, idx) => (
            <TickItem key={time} time={time} index={idx} scrollX={scrollX} textColor={textColor} minorTickColor={minorTickColor} majorTickColor={majorTickColor} />
          ))}
        </Reanimated.ScrollView>
      </View>
      {/* Triangle pointer */}
      <View style={{ position: 'relative', height: 24, marginTop: 6 }}>
        <View
          style={{
            position: 'absolute',
            left: centerPosition - 8,
            width: 0,
            height: 0,
            borderLeftWidth: 8,
            borderRightWidth: 8,
            borderBottomWidth: 12,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderBottomColor: indicatorColor,
          }}
        />
      </View>
    </View>
  );
};
