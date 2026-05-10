import { FC, useRef, useState, useCallback, useEffect } from 'react';
import { View, ScrollView, Pressable, Text, Animated, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../ui/Typography';
import { BottomSheet } from '../../ui/BottomSheet';

interface WheelTimePickerProps {
  selectedTime: number; // total minutes
  onTimeChange: (time: number) => void;
}

const HOURS = Array.from({ length: 9 }, (_, i) => i); // 0–8
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0–59

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const FONT_BOLD = 'Poppins-Bold';

/** Format a total-minutes value into a display string like "0m", "1h30m", "8h" */
const formatDisplay = (totalMinutes: number): string => {
  if (totalMinutes === 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}m`;
};

/**
 * Animated wheel item — opacity and scale driven by scroll position.
 */
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
        }}
      >
        {display}
      </Animated.Text>
    </View>
  );
};

/**
 * A single wheel column using plain ScrollView to avoid native gesture
 * conflicts inside Modal/BottomSheet.
 */
const WheelColumn: FC<{
  values: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  label: string;
  formatValue?: (v: number) => string;
}> = ({ values, selectedValue, onValueChange, label, formatValue }) => {
  const scrollRef = useRef<ScrollView>(null);
  const lastSnappedRef = useRef(selectedValue);
  const isUserScrollingRef = useRef(false);
  const scrollY = useRef(new Animated.Value(values.indexOf(selectedValue) * ITEM_HEIGHT)).current;

  // Scroll to selected value on mount or external change
  useEffect(() => {
    if (isUserScrollingRef.current) return;
    const idx = values.indexOf(selectedValue);
    if (idx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
  }, [selectedValue, values]);

  const handleScrollBeginDrag = useCallback(() => {
    isUserScrollingRef.current = true;
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      scrollY.setValue(offsetY);

      if (!isUserScrollingRef.current) return;
      const idx = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(values.length - 1, idx));
      const snappedValue = values[clamped];
      if (snappedValue !== lastSnappedRef.current) {
        lastSnappedRef.current = snappedValue;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [scrollY, values],
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
    [values, selectedValue, onValueChange],
  );

  const paddingVertical = (PICKER_HEIGHT - ITEM_HEIGHT) / 2;

  return (
    <View style={{ flex: 1 }}>
      <Typography variant="body-12" color="secondary" className="mb-2" style={{ textAlign: 'center' }}>
        {label}
      </Typography>
      <View style={{ height: PICKER_HEIGHT, overflow: 'hidden', width: '100%' }}>
        {/* Selection indicator lines */}
        <View
          style={{
            position: 'absolute',
            top: paddingVertical,
            left: 16,
            right: 16,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
          pointerEvents="none"
        />
        <View
          style={{
            position: 'absolute',
            top: paddingVertical + ITEM_HEIGHT,
            left: 16,
            right: 16,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
          pointerEvents="none"
        />
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onScrollBeginDrag={handleScrollBeginDrag}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical }}
        >
          {values.map((v, idx) => {
            const display = formatValue ? formatValue(v) : String(v);
            return <WheelItem key={v} index={idx} display={display} scrollY={scrollY} />;
          })}
        </ScrollView>
      </View>
    </View>
  );
};

export const WheelTimePicker: FC<WheelTimePickerProps> = ({
  selectedTime,
  onTimeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingHours, setPendingHours] = useState(Math.floor(selectedTime / 60));
  const [pendingMinutes, setPendingMinutes] = useState(selectedTime % 60);

  // Sync pending values when selectedTime changes externally
  useEffect(() => {
    if (!isOpen) {
      setPendingHours(Math.floor(selectedTime / 60));
      setPendingMinutes(selectedTime % 60);
    }
  }, [selectedTime, isOpen]);

  const handleOpen = useCallback(() => {
    setPendingHours(Math.floor(selectedTime / 60));
    setPendingMinutes(selectedTime % 60);
    setIsOpen(true);
  }, [selectedTime]);

  const handleConfirm = useCallback(() => {
    // Clamp total to 480 max (8h)
    const totalMinutes = Math.min(pendingHours * 60 + pendingMinutes, 480);
    onTimeChange(totalMinutes);
    setIsOpen(false);
  }, [pendingHours, pendingMinutes, onTimeChange]);

  const handleHourChange = useCallback((h: number) => {
    setPendingHours(h);
  }, []);

  const handleMinuteChange = useCallback((m: number) => {
    setPendingMinutes(m);
  }, []);

  return (
    <View style={{ height: 140, justifyContent: 'center', alignItems: 'center' }}>
      {/* Tappable display */}
      <Pressable onPress={handleOpen} style={{ alignItems: 'center' }}>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 64,
            fontFamily: 'Poppins-Bold',
            textAlign: 'center',
          }}
        >
          {formatDisplay(selectedTime)}
        </Text>
      </Pressable>

      {/* Wheel picker modal */}
      <BottomSheet
        isVisible={isOpen}
        onClose={() => setIsOpen(false)}
        height={460}
        showHandle={false}
      >
        <Typography variant="headline-20" color="white" className="mb-4">
          Set Duration
        </Typography>

        <View style={{ flexDirection: 'row', flex: 1, marginHorizontal: -24 }}>
          <WheelColumn
            values={HOURS}
            selectedValue={pendingHours}
            onValueChange={handleHourChange}
            label="Hours"
          />
          <WheelColumn
            values={MINUTES}
            selectedValue={pendingMinutes}
            onValueChange={handleMinuteChange}
            label="Minutes"
            formatValue={(v) => String(v).padStart(2, '0')}
          />
        </View>

        {/* Confirm button */}
        <Pressable
          onPress={handleConfirm}
          className="mt-4 mb-2 bg-primary rounded-2xl py-3 items-center active:opacity-80"
        >
          <Typography variant="subtitle-16" color="white">
            Confirm
          </Typography>
        </Pressable>
      </BottomSheet>
    </View>
  );
};
