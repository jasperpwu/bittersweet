import { FC, useRef, useCallback, useEffect } from 'react';
import { View, Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../Typography';

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const FONT_BOLD = 'Poppins-Bold';

const WheelItem: FC<{
  index: number;
  display: string;
  scrollY: Animated.Value;
}> = ({ index, display, scrollY }) => {
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
          color: '#FFFFFF',
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
};

interface WheelColumnProps {
  values: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  label: string;
  formatValue?: (v: number) => string;
  indicatorPadding?: number;
}

export const WheelColumn: FC<WheelColumnProps> = ({ 
  values, 
  selectedValue, 
  onValueChange, 
  label, 
  formatValue,
  indicatorPadding = 8 
}) => {
  const scrollRef = useRef<any>(null);
  const lastSnappedRef = useRef(selectedValue);
  const isUserScrollingRef = useRef(false);
  const initialOffsetRef = useRef({
    x: 0,
    y: Math.max(0, values.indexOf(selectedValue)) * ITEM_HEIGHT,
  });
  const scrollY = useRef(new Animated.Value(initialOffsetRef.current.y)).current;

  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!hasMountedRef.current) return;
    if (isUserScrollingRef.current) return;
    const idx = values.indexOf(selectedValue);
    if (idx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
  }, [selectedValue, values]);

  const handleLayout = useCallback(() => {
    if (hasMountedRef.current) return;
    hasMountedRef.current = true;
    const idx = values.indexOf(selectedValue);
    if (idx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
  }, [values, selectedValue]);

  const handleScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
  }, []);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (e: any) => {
        const offsetY = e.nativeEvent.contentOffset.y;
        if (!isUserScrollingRef.current) return;
        const idx = Math.round(offsetY / ITEM_HEIGHT);
        const clamped = Math.max(0, Math.min(values.length - 1, idx));
        const snappedValue = values[clamped];
        if (snappedValue !== lastSnappedRef.current) {
          lastSnappedRef.current = snappedValue;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onValueChange(snappedValue);
        }
      },
    }
  );

  const handleMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      const value = values[clamped];
      if (value !== selectedValue) {
        onValueChange(value);
      }
      lastSnappedRef.current = value;
      isUserScrollingRef.current = false;
    },
    [values, selectedValue, onValueChange]
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
            backgroundColor: 'rgba(255,255,255,0.15)',
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
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
          pointerEvents="none"
        />
        <Animated.ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          disableIntervalMomentum={true}
          contentOffset={initialOffsetRef.current}
          onLayout={handleLayout}
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical }}>
          {values.map((v, idx) => {
            const display = formatValue ? formatValue(v) : String(v);
            return <WheelItem key={v} index={idx} display={display} scrollY={scrollY} />;
          })}
        </Animated.ScrollView>
      </View>
    </View>
  );
};
