import { FC, useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  Text,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useColorScheme,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../ui/Typography';
import { colors } from '../../../config/theme';
import { BottomSheet } from '../../ui/BottomSheet';
import { WheelColumn } from '../../ui/WheelColumn';

interface DurationPickerProps {
  selectedTime: number; // total minutes
  onTimeChange: (time: number) => void;
}

const HOURS = Array.from({ length: 9 }, (_, i) => i); // 0–8
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0–59

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const SHEET_HEIGHT = 420;
const FONT_BOLD = 'Poppins-Bold';

/** Format a total-minutes value into a display string like "0m", "1h30m", "8h" */
const formatDisplay = (totalMinutes: number): string => {
  if (totalMinutes === 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}m`;
};



export const DurationPicker: FC<DurationPickerProps> = ({ selectedTime, onTimeChange }) => {
  const colorScheme = useColorScheme();
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
            color: colorScheme === 'dark' ? colors.dark.textPrimary : colors.light.screenTextPrimary,
            fontSize: 64,
            fontFamily: 'Poppins-Bold',
            textAlign: 'center',
          }}>
          {formatDisplay(selectedTime)}
        </Text>
      </Pressable>

      {/* Wheel picker modal */}
      <BottomSheet
        isVisible={isOpen}
        onClose={() => setIsOpen(false)}
        height={SHEET_HEIGHT}
>
        <View style={{ paddingTop: 24 }}>
          <Typography variant="headline-20" color="primary" className="mb-3">
            Set Duration
          </Typography>

          <View style={{ flexDirection: 'row', marginHorizontal: -24 }}>
            <WheelColumn
              values={HOURS}
              selectedValue={pendingHours}
              onValueChange={handleHourChange}
              label="Hours"
              indicatorPadding={16}
            />
            <WheelColumn
              values={MINUTES}
              selectedValue={pendingMinutes}
              onValueChange={handleMinuteChange}
              label="Minutes"
              formatValue={(v) => String(v).padStart(2, '0')}
              indicatorPadding={16}
            />
          </View>

          {/* Confirm button */}
          <Pressable
            onPress={handleConfirm}
            className="mb-2 mt-2 items-center rounded-2xl bg-primary py-3 active:opacity-80">
            <Typography variant="subtitle-16" color="white">
              Confirm
            </Typography>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
};
