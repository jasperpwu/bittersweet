import { FC, memo, useRef, useCallback, useEffect } from 'react';
import { View, Animated, NativeSyntheticEvent, NativeScrollEvent, useColorScheme } from 'react-native';
import { colors } from '../../../config/theme';
import * as Haptics from 'expo-haptics';
import { Typography } from '../Typography';

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const FONT_BOLD = 'Poppins-Bold';

// In loop mode the value list is stacked `loopCopies` times and the middle
// ("home") copy is where the wheel rests. We recenter onto home only at rest
// (drag/momentum end) — never mid-fling, because programmatically setting
// contentOffset during a fling cancels the deceleration on iOS, which made short
// wheels (hours, N=9) dead-stop on one fixed value. The runway must therefore be
// long enough that a single hard fling can't reach an edge before it settles, so
// short lists get more copies; long lists (minutes, N=60) already have ample
// runway at the minimum, so we don't bloat them with hundreds of extra items.
const MAX_FLING_PX = 1200; // generous upper bound on one fling's travel
const computeLoopCopies = (cycle: number): number => {
  const minForFling = Math.ceil((2 * MAX_FLING_PX) / cycle) + 1;
  let copies = Math.max(3, minForFling);
  if (copies % 2 === 0) copies += 1; // odd → a single middle "home" copy
  return copies;
};

const WheelItem: FC<{
  index: number;
  display: string;
  scrollY: Animated.Value;
  textColor: string;
}> = memo(({ index, display, scrollY, textColor }) => {
  const itemCenter = index * ITEM_HEIGHT;

  const inputRange = [
    itemCenter - ITEM_HEIGHT * 2,
    itemCenter - ITEM_HEIGHT,
    itemCenter,
    itemCenter + ITEM_HEIGHT,
    itemCenter + ITEM_HEIGHT * 2,
  ];

  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.2, 0.4, 1, 0.4, 0.2],
    extrapolate: 'clamp',
  });

  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.75, 0.85, 1, 0.85, 0.75],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
      <Animated.Text
        style={{
          color: textColor,
          fontSize: 22,
          fontFamily: FONT_BOLD,
          textAlign: 'center',
          opacity,
          transform: [{ scale }],
        }}>
        {display}
      </Animated.Text>
    </View>
  );
});
WheelItem.displayName = 'WheelItem';

interface WheelColumnProps {
  values: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  label: string;
  formatValue?: (v: number) => string;
  indicatorPadding?: number;
  /** Enable infinite wraparound scrolling (the ends of the list connect). */
  loop?: boolean;
  /**
   * Fired once per seam crossing while looping: +1 when the wheel scrolls
   * forward past the last value into the first (e.g. minute 59 → 0), -1 for the
   * reverse. Lets a parent carry the crossing into an adjacent wheel (e.g. bump
   * the hour). Fires only during user-driven scrolls, never programmatic ones.
   */
  onWrap?: (direction: 1 | -1) => void;
}

export const WheelColumn: FC<WheelColumnProps> = ({
  values,
  selectedValue,
  onValueChange,
  label,
  formatValue,
  indicatorPadding = 8,
  loop = false,
  onWrap,
}) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const textColor = isDark ? colors.dark.textPrimary : colors.light.screenTextPrimary;
  const separatorColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(93,78,55,0.15)';
  const scrollRef = useRef<any>(null);
  const lastSnappedRef = useRef(selectedValue);
  const isUserScrollingRef = useRef(false);

  const N = values.length;
  const cycle = N * ITEM_HEIGHT; // scroll distance of one full loop
  const loopCopies = loop ? computeLoopCopies(cycle) : 1;
  const homeStart = loop ? ((loopCopies - 1) / 2) * N : 0; // middle copy's first item
  const displayValues = loop
    ? Array.from({ length: loopCopies }, () => values).flat()
    : values;

  const initialIndex = Math.max(0, values.indexOf(selectedValue));
  const initialY = (homeStart + initialIndex) * ITEM_HEIGHT;

  const initialOffsetRef = useRef({ x: 0, y: initialY });
  const scrollY = useRef(new Animated.Value(initialY)).current;

  // Loop bookkeeping. `logical` is a free-running offset that keeps accumulating
  // across silent recenters, so seam crossings can be counted reliably even when
  // the raw scroll position is being shifted back to the home copy.
  const prevRawRef = useRef(initialY);
  const logicalRef = useRef(initialY);
  const wrapBucketRef = useRef(cycle > 0 ? Math.floor(initialY / cycle) : 0);

  /** Value shown at a given raw scroll offset. */
  const valueAtOffset = useCallback(
    (offsetY: number) => {
      const rawIdx = Math.round(offsetY / ITEM_HEIGHT);
      if (loop) {
        return values[((rawIdx % N) + N) % N];
      }
      const clamped = Math.max(0, Math.min(N - 1, rawIdx));
      return values[clamped];
    },
    [loop, values, N]
  );

  const scrollToValue = useCallback(
    (value: number, resetLoopState: boolean) => {
      const idx = values.indexOf(value);
      if (idx < 0 || !scrollRef.current) return;
      const y = (homeStart + idx) * ITEM_HEIGHT;
      scrollRef.current.scrollTo({ y, animated: false });
      if (loop && resetLoopState) {
        prevRawRef.current = y;
        logicalRef.current = y;
        wrapBucketRef.current = cycle > 0 ? Math.floor(y / cycle) : 0;
        lastSnappedRef.current = value;
      }
    },
    [values, homeStart, loop, cycle]
  );

  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) return;
    if (isUserScrollingRef.current) return;
    scrollToValue(selectedValue, true);
  }, [selectedValue, values, scrollToValue]);

  const handleLayout = useCallback(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;
    scrollToValue(selectedValue, true);
  }, [selectedValue, scrollToValue]);

  const handleScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
  }, []);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (e: any) => {
        const raw = e.nativeEvent.contentOffset.y;
        if (!isUserScrollingRef.current) {
          prevRawRef.current = raw;
          return;
        }

        if (loop) {
          // Accumulate travel and emit a carry for every seam crossed.
          logicalRef.current += raw - prevRawRef.current;
          prevRawRef.current = raw;
          const bucket = Math.floor(logicalRef.current / cycle);
          while (wrapBucketRef.current < bucket) {
            wrapBucketRef.current += 1;
            onWrap?.(1);
          }
          while (wrapBucketRef.current > bucket) {
            wrapBucketRef.current -= 1;
            onWrap?.(-1);
          }
        }

        const snappedValue = valueAtOffset(raw);
        if (snappedValue !== lastSnappedRef.current) {
          lastSnappedRef.current = snappedValue;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onValueChange(snappedValue);
        }
        // NOTE: recentering onto the home copy happens only at rest (see
        // recenterToHome / settleAt below), never here — doing it mid-fling
        // cancels iOS momentum. The runway (loopCopies) is sized so a single
        // fling can't reach an edge before settling.
      },
    }
  );

  // Shift onto the home copy once the wheel is at rest. Safe here (no active
  // fling to cancel) and invisible: moving by a whole number of copies lands on
  // an item boundary with the same value under the indicator.
  const recenterToHome = useCallback(
    (value: number) => {
      if (!loop) return;
      const idx = values.indexOf(value);
      if (idx < 0) return;
      const homeY = (homeStart + idx) * ITEM_HEIGHT;
      scrollRef.current?.scrollTo({ y: homeY, animated: false });
      prevRawRef.current = homeY;
      logicalRef.current = homeY;
      wrapBucketRef.current = cycle > 0 ? Math.floor(homeY / cycle) : 0;
    },
    [loop, values, homeStart, cycle]
  );

  const settleAt = useCallback(
    (raw: number) => {
      const value = valueAtOffset(raw);
      if (value !== selectedValue) {
        onValueChange(value);
      }
      lastSnappedRef.current = value;
      isUserScrollingRef.current = false;
      if (loop) {
        recenterToHome(value);
      } else {
        prevRawRef.current = raw;
      }
    },
    [valueAtOffset, selectedValue, onValueChange, loop, recenterToHome]
  );

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      settleAt(e.nativeEvent.contentOffset.y);
    },
    [settleAt]
  );

  // A slow release with no fling produces no momentum event on iOS, so settle
  // here instead. Skip when there's real velocity — momentum will follow and
  // recentering now would cancel its deceleration (the bug we're avoiding).
  const handleScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityY = e.nativeEvent.velocity?.y ?? 0;
      if (Math.abs(velocityY) < 0.05) {
        settleAt(e.nativeEvent.contentOffset.y);
      }
    },
    [settleAt]
  );

  const paddingVertical = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

  return (
    <View style={{ flex: 1 }}>
      <Typography
        variant="body-12"
        color="secondary"
        className="mb-2"
        style={{ textAlign: 'center' }}>
        {label}
      </Typography>
      <View style={{ height: PICKER_HEIGHT, overflow: 'hidden', width: '100%' }}>
        <View
          style={{
            position: 'absolute',
            top: paddingVertical,
            left: indicatorPadding,
            right: indicatorPadding,
            height: 1,
            backgroundColor: separatorColor,
          }}
          pointerEvents="none"
        />
        <View
          style={{
            position: 'absolute',
            top: paddingVertical + ITEM_HEIGHT,
            left: indicatorPadding,
            right: indicatorPadding,
            height: 1,
            backgroundColor: separatorColor,
          }}
          pointerEvents="none"
        />
        <Animated.ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          contentOffset={initialOffsetRef.current}
          onLayout={handleLayout}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical }}>
          {displayValues.map((v, idx) => {
            const display = formatValue ? formatValue(v) : String(v);
            return <WheelItem key={idx} index={idx} display={display} scrollY={scrollY} textColor={textColor} />;
          })}
        </Animated.ScrollView>
      </View>
    </View>
  );
};
