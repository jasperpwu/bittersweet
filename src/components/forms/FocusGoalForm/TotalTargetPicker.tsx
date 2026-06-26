import { FC, useState, useCallback } from 'react';
import { View, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui/Typography';
import { WheelColumn } from '../../ui/WheelColumn';

// Cumulative lifetime target: 1–1000 hours, 0–59 minutes.
const HOURS = Array.from({ length: 1000 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const formatDisplay = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

interface TotalTargetPickerProps {
  /** Total target in minutes. */
  value: number;
  onChange: (totalMinutes: number) => void;
}

/**
 * Tappable display that opens a wheel picker (hours + minutes) for a no-period
 * goal's cumulative target. Rendered in a Modal so it sits above the goal form's
 * scroll view without nested-scroll gesture conflicts (mirrors TimePicker).
 */
export const TotalTargetPicker: FC<TotalTargetPickerProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingHours, setPendingHours] = useState(Math.max(1, Math.floor(value / 60)));
  const [pendingMinutes, setPendingMinutes] = useState(value % 60);

  const handleOpen = useCallback(() => {
    setPendingHours(Math.max(1, Math.floor(value / 60)));
    setPendingMinutes(value % 60);
    setIsOpen(true);
  }, [value]);

  const handleConfirm = useCallback(() => {
    onChange(pendingHours * 60 + pendingMinutes);
    setIsOpen(false);
  }, [pendingHours, pendingMinutes, onChange]);

  return (
    <>
      <Pressable
        onPress={handleOpen}
        className="flex-row items-center justify-between bg-light-border dark:bg-dark-border rounded-xl px-4 py-4 active:opacity-80"
      >
        <Typography variant="headline-20" color="primary">
          {formatDisplay(value)}
        </Typography>
        <Ionicons name="chevron-down" size={20} color="#6592E9" />
      </Pressable>

      {isOpen && (
        <Modal transparent visible animationType="fade" onRequestClose={() => setIsOpen(false)}>
          <View className="flex-1 bg-black/60 justify-center items-center px-6">
            <View className="bg-light-bg dark:bg-dark-bg rounded-3xl p-6 w-full max-w-sm border border-light-border dark:border-dark-border">
              <Typography variant="headline-20" color="primary" className="mb-4 text-center">
                {t('goals.totalTarget')}
              </Typography>

              <View style={{ flexDirection: 'row' }}>
                <WheelColumn
                  values={HOURS}
                  selectedValue={pendingHours}
                  onValueChange={setPendingHours}
                  label={t('goals.totalTargetHours')}
                />
                <WheelColumn
                  values={MINUTES}
                  selectedValue={pendingMinutes}
                  onValueChange={setPendingMinutes}
                  label={t('goals.totalTargetMinutes')}
                  formatValue={(v) => String(v).padStart(2, '0')}
                />
              </View>

              <View className="flex-row justify-end mt-6 gap-3">
                <Pressable
                  onPress={() => setIsOpen(false)}
                  className="flex-1 bg-light-border dark:bg-dark-border rounded-xl py-3 items-center justify-center active:opacity-80"
                >
                  <Typography variant="subtitle-14-semibold" color="primary">
                    {t('common.cancel')}
                  </Typography>
                </Pressable>
                <Pressable
                  onPress={handleConfirm}
                  className="flex-1 bg-primary rounded-xl py-3 items-center justify-center active:opacity-80"
                >
                  <Typography variant="subtitle-14-semibold" color="white">
                    {t('common.confirm')}
                  </Typography>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};
