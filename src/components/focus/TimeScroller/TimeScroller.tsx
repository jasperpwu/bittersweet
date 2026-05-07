import { FC, useRef, useEffect, useMemo } from 'react';
import { View, Dimensions, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TimeScrollerProps {
  selectedTime: number;
  onTimeChange: (time: number) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const TICK_SPACING = 100;
// -1 is a dev-only sentinel for "5 seconds" test mode
const TIME_VALUES = __DEV__
  ? [-1, ...Array.from({ length: 13 }, (_, i) => i * 5)]  // -1, 0, 5, 10, ... 60
  : Array.from({ length: 13 }, (_, i) => i * 5);           // 0, 5, 10, ... 60

const FONT_BOLD = 'Poppins-Bold';

const centerPosition = screenWidth / 2;
const centerOffset = (screenWidth - TICK_SPACING) / 2;

/**
 * Animated tick item that reacts to scroll position for smooth scale/opacity transitions.
 */
const TickItem: FC<{
  time: number;
  index: number;
  scrollX: Animated.Value;
}> = ({ time, index, scrollX }) => {
  const itemCenter = index * TICK_SPACING; // scroll position when this item is centered

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

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.42, 0.5, 0.62, 1, 0.62, 0.5, 0.42],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.2, 0.35, 0.6, 1, 0.6, 0.35, 0.2],
    extrapolate: 'clamp',
  });

  // Tick height: hide when centered (selected), show otherwise
  const tickOpacity = scrollX.interpolate({
    inputRange: [itemCenter - TICK_SPACING * 0.5, itemCenter, itemCenter + TICK_SPACING * 0.5],
    outputRange: [0.4, 0, 0.4],
    extrapolate: 'clamp',
  });

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
        <Animated.Text
          style={{
            color: '#FFFFFF',
            fontSize: 56,
            fontFamily: FONT_BOLD,
            textAlign: 'center',
            paddingBottom: 100,
            opacity,
            transform: [{ scale }],
          }}
        >
          {time === -1 ? '5s' : time === 0 ? '∞' : time}
        </Animated.Text>
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
                backgroundColor: 'rgba(255,255,255,0.25)',
                borderRadius: 1,
              }}
            />
          );
        })}
      </View>

      {/* Major tick */}
      <Animated.View
        style={{
          width: 3,
          height: 24,
          backgroundColor: '#FFFFFF',
          borderRadius: 1.5,
          opacity: tickOpacity,
        }}
      />
    </View>
  );
};

export const TimeScroller: FC<TimeScrollerProps> = ({
  selectedTime,
  onTimeChange,
}) => {
  const scrollViewRef = useRef<typeof Animated.ScrollView | null>(null);
  const isUserScrollingRef = useRef(false);
  const lastSnappedRef = useRef(selectedTime);
  const timeToIndex = (time: number) => TIME_VALUES.indexOf(time);
  const scrollX = useRef(new Animated.Value(timeToIndex(selectedTime) * TICK_SPACING)).current;

  useEffect(() => {
    if (isUserScrollingRef.current) return;
    if (scrollViewRef.current) {
      const tickIndex = timeToIndex(selectedTime);
      const scrollPosition = tickIndex * TICK_SPACING;
      (scrollViewRef.current as any).scrollTo({ x: scrollPosition, animated: false });
    }
  }, [selectedTime]);

  // Haptic feedback during scroll — fire when crossing a snap boundary
  useEffect(() => {
    const listenerId = scrollX.addListener(({ value }) => {
      if (!isUserScrollingRef.current) return;
      const snappedIndex = Math.max(0, Math.min(TIME_VALUES.length - 1, Math.round(value / TICK_SPACING)));
      const snappedTime = TIME_VALUES[snappedIndex];
      if (snappedTime !== lastSnappedRef.current) {
        lastSnappedRef.current = snappedTime;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    });
    return () => scrollX.removeListener(listenerId);
  }, [scrollX]);

  const handleScrollBeginDrag = () => {
    isUserScrollingRef.current = true;
  };

  // Only finalize on momentum end — with snapToInterval the snap animation
  // always triggers onMomentumScrollEnd, so this is the reliable "settled" event.
  // Handling onScrollEndDrag too would update state before the snap animation
  // finishes, causing a feedback loop (jiggle) between programmatic scrollTo
  // and the native snap.
  const handleMomentumScrollEnd = (event: any) => {
    const scrollXVal = event.nativeEvent.contentOffset.x;
    const snappedIndex = Math.round(scrollXVal / TICK_SPACING);
    const clampedIndex = Math.max(0, Math.min(TIME_VALUES.length - 1, snappedIndex));
    const snappedTime = TIME_VALUES[clampedIndex];

    if (snappedTime !== selectedTime) {
      onTimeChange(snappedTime);
    }

    lastSnappedRef.current = snappedTime;
    isUserScrollingRef.current = false;
  };

  const onScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true },
      ),
    [scrollX],
  );

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
            backgroundColor: '#FFFFFF',
            borderRadius: 3,
            zIndex: 10,
          }}
        />
        <Animated.ScrollView
          ref={scrollViewRef as any}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={onScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={TICK_SPACING}
          snapToAlignment="start"
          contentContainerStyle={{
            paddingHorizontal: centerOffset,
          }}
        >
          {TIME_VALUES.map((time, idx) => (
            <TickItem key={time} time={time} index={idx} scrollX={scrollX} />
          ))}
        </Animated.ScrollView>
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
            borderBottomColor: '#FFFFFF',
          }}
        />
      </View>
    </View>
  );
};
