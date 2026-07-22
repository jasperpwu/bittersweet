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
import { colors } from '../../../config/theme';
import * as Haptics from 'expo-haptics';
import { Typography } from '../Typography';
import { WheelColumn } from '../WheelColumn';

// ── Wheel constants ──────────────────────────────────────────────────────────

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const FONT_BOLD = 'Poppins-Bold';

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1–12
const MINUTES_60 = Array.from({ length: 60 }, (_, i) => i); // 0–59
const PERIODS = [0, 1]; // 0 = AM, 1 = PM



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

/** Convert 12h clock parts → hour of day (0-23). */
const to24Hour = (hour12: number, period: number): number =>
  (hour12 % 12) + (period === 1 ? 12 : 0);

/** Convert hour of day (0-23) → { hour12 (1-12), period (0=AM,1=PM) }. */
const from24Hour = (h24: number): { hour12: number; period: number } => {
  const period = h24 >= 12 ? 1 : 0;
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12, period };
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

  // Mirror of the current hour-of-day so rapid, same-frame minute carries
  // compound correctly (stale-closure-safe) and can cascade AM/PM.
  const hour24Ref = useRef(to24Hour(pendingHour, pendingPeriod));
  useEffect(() => {
    hour24Ref.current = to24Hour(pendingHour, pendingPeriod);
  }, [pendingHour, pendingPeriod]);

  // Minute wheel crossing its 59↔0 seam carries a full clock hour, cascading
  // into AM/PM (11:59 AM + 1min → 12:00 PM) and wrapping across midnight.
  const handleMinuteWrap = (direction: 1 | -1) => {
    const next = (hour24Ref.current + direction + 24) % 24;
    hour24Ref.current = next;
    const { hour12, period } = from24Hour(next);
    setPendingHour(hour12);
    setPendingPeriod(period);
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
        <Typography variant="subtitle-14-medium" color="primary" className="mb-2">
          {label}
        </Typography>
      )}

      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className={`
          flex-row items-center justify-between
          bg-transparent border border-light-border dark:border-dark-border
          rounded-xl px-4 py-3 min-h-12
          ${disabled ? 'opacity-50' : 'active:opacity-80'}
          ${error ? 'border-error' : ''}
        `}
        accessibilityRole="button"
        accessibilityLabel={`Select time, currently ${formatTime(value)}`}
        accessibilityHint="Double tap to open time picker">
        <Typography variant="body-14" color="primary">
          {formatTime(value)}
        </Typography>

        <Ionicons name="time-outline" size={20} color={colors.primary} />
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
              <View className="bg-light-bg dark:bg-dark-bg rounded-3xl p-6 w-full max-w-sm border border-light-border dark:border-dark-border">
                <Typography variant="headline-20" color="primary" className="mb-4 text-center">
                  Select Time
                </Typography>

                {/* Three independent wheel columns */}
                <View style={{ flexDirection: 'row' }}>
                  <WheelColumn
                    values={HOURS_12}
                    selectedValue={pendingHour}
                    onValueChange={setPendingHour}
                    label="Hour"
                    loop
                  />
                  <WheelColumn
                    values={MINUTES_60}
                    selectedValue={pendingMinute}
                    onValueChange={setPendingMinute}
                    label="Min"
                    formatValue={(v) => String(v).padStart(2, '0')}
                    loop
                    onWrap={handleMinuteWrap}
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
                    className="flex-1 bg-light-border/30 dark:bg-gray-700 rounded-xl py-3 items-center justify-center active:opacity-80">
                    <Typography variant="subtitle-14-semibold" color="primary">
                      Cancel
                    </Typography>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirm}
                    className="flex-1 bg-primary rounded-xl py-3 items-center justify-center active:opacity-80">
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
