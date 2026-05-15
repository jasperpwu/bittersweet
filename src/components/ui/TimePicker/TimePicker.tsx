import { FC, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Pressable,
  Platform,
  Modal,
  ScrollView,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '../Typography';

// ── Wheel constants ──────────────────────────────────────────────────────────

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const FONT_BOLD = 'Poppins-Bold';

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i); // 0–59
const PERIODS = [0, 1]; // 0 = AM, 1 = PM

// ── WheelItem ────────────────────────────────────────────────────────────────

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

// ── WheelColumn ──────────────────────────────────────────────────────────────

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
  // Store the initial offset in a ref so it never changes after mount.
  const initialOffsetRef = useRef({
    x: 0,
    y: Math.max(0, values.indexOf(selectedValue)) * ITEM_HEIGHT,
  });
  const scrollY = useRef(
    new Animated.Value(initialOffsetRef.current.y)
  ).current;

  // Scroll to new position when selectedValue changes after mount.
  // Skip the first render — onLayout handles that.
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
    // Ensure scroll position is correct once layout is ready
    const idx = values.indexOf(selectedValue);
    if (idx >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }
  }, [values, selectedValue]);

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
    [scrollY, values]
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
        {/* Selection indicator lines */}
        <View
          style={{
            position: 'absolute',
            top: paddingVertical,
            left: 8,
            right: 8,
            height: 1,
            backgroundColor: 'rgba(255,255,255,0.15)',
          }}
          pointerEvents="none"
        />
        <View
          style={{
            position: 'absolute',
            top: paddingVertical + ITEM_HEIGHT,
            left: 8,
            right: 8,
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
        </ScrollView>
      </View>
    </View>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Date → { hour12, minute, period } */
const dateTo12h = (date: Date) => {
  let h = date.getHours(); // 0-23
  const m = date.getMinutes();
  const period = h >= 12 ? 1 : 0; // 1 = PM
  h = h % 12;
  if (h === 0) h = 12;
  return { hour12: h, minute: m, period };
};

/** Convert { hour12, minute, period } → Date (preserving year/month/day from base) */
const to24hDate = (base: Date, hour12: number, minute: number, period: number): Date => {
  const d = new Date(base);
  let h24 = hour12 % 12; // 12 → 0
  if (period === 1) h24 += 12; // PM offset
  d.setHours(h24, minute, 0, 0);
  return d;
};

// ── TimePicker ───────────────────────────────────────────────────────────────

interface TimePickerProps {
  value: Date;
  onChange: (time: Date) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export const TimePicker: FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  error,
  disabled = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  // Pending wheel state — initialised from value, synced on open via handlePress
  const [pendingHour, setPendingHour] = useState(() => dateTo12h(value).hour12);
  const [pendingMinute, setPendingMinute] = useState(() => dateTo12h(value).minute);
  const [pendingPeriod, setPendingPeriod] = useState(() => dateTo12h(value).period);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Android still uses native picker (no known bug there)
  const handleTimeChange = (_event: any, selectedTime?: Date) => {
    setShowPicker(false);
    if (selectedTime) {
      onChange(selectedTime);
    }
  };

  const handleConfirm = () => {
    setShowPicker(false);
    onChange(to24hDate(value, pendingHour, pendingMinute, pendingPeriod));
  };

  const handleCancel = () => {
    setShowPicker(false);
  };

  const handlePress = () => {
    if (!disabled) {
      // Set pending values synchronously BEFORE opening the modal
      // so WheelColumns mount with the correct initial positions.
      const { hour12, minute, period } = dateTo12h(value);
      setPendingHour(hour12);
      setPendingMinute(minute);
      setPendingPeriod(period);
      setShowPicker(true);
    }
  };

  return (
    <View className="w-full">
      {label && (
        <Typography variant="subtitle-14-medium" color="white" className="mb-2">
          {label}
        </Typography>
      )}

      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className={`
          flex-row items-center justify-between
          bg-transparent border border-dark-border
          rounded-xl px-4 py-3 min-h-12
          ${disabled ? 'opacity-50' : 'active:opacity-80'}
          ${error ? 'border-error' : ''}
        `}
        accessibilityRole="button"
        accessibilityLabel={`Select time, currently ${formatTime(value)}`}
        accessibilityHint="Double tap to open time picker">
        <Typography variant="body-14" color="white">
          {formatTime(value)}
        </Typography>

        <Ionicons name="time-outline" size={20} color="#6592E9" />
      </Pressable>

      {error && (
        <Typography variant="body-12" color="error" className="mt-1">
          {error}
        </Typography>
      )}

      {showPicker &&
        (Platform.OS === 'ios' ? (
          <Modal transparent visible animationType="none">
            <View className="flex-1 bg-black/60 justify-center items-center px-6">
              <View className="bg-dark-bg rounded-3xl p-6 w-full max-w-sm border border-dark-border">
                <Typography variant="headline-20" color="white" className="mb-4 text-center">
                  Select Time
                </Typography>

                {/* Three independent wheel columns */}
                <View style={{ flexDirection: 'row' }}>
                  <WheelColumn
                    values={HOURS_12}
                    selectedValue={pendingHour}
                    onValueChange={setPendingHour}
                    label="Hour"
                  />
                  <WheelColumn
                    values={MINUTES_60}
                    selectedValue={pendingMinute}
                    onValueChange={setPendingMinute}
                    label="Min"
                    formatValue={(v) => String(v).padStart(2, '0')}
                  />
                  <WheelColumn
                    values={PERIODS}
                    selectedValue={pendingPeriod}
                    onValueChange={setPendingPeriod}
                    label=" "
                    formatValue={(v) => (v === 0 ? 'AM' : 'PM')}
                  />
                </View>

                <View className="flex-row justify-end mt-6 gap-3">
                  <Pressable
                    onPress={handleCancel}
                    className="flex-1 bg-gray-700 rounded-xl py-3 items-center justify-center active:opacity-80">
                    <Typography variant="subtitle-14-semibold" color="white">
                      Cancel
                    </Typography>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirm}
                    className="flex-1 bg-[#6592E9] rounded-xl py-3 items-center justify-center active:opacity-80">
                    <Typography variant="subtitle-14-semibold" color="white">
                      Confirm
                    </Typography>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={value}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        ))}
    </View>
  );
};
