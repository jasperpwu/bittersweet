import { View, Pressable } from 'react-native';
import { Typography } from '../../ui';
import type { ActivityType } from '../../../utils/focusRating';

const OPTIONS: { value: ActivityType; label: string; icon: string }[] = [
  { value: 'stationary', label: 'Stationary', icon: '🪑' },
  { value: 'on_phone', label: 'On-phone', icon: '📱' },
  { value: 'active', label: 'Active', icon: '🏃' },
];

interface ActivityTypePickerProps {
  value?: ActivityType;
  onChange: (value: ActivityType | undefined) => void;
}

/**
 * Optional 3-way picker for a tag's activity type. Tapping the selected option
 * again clears it (activity type is optional; unset is treated as stationary by
 * the focus-rating engine). Drives how motion maps to the suggested focus rating.
 */
export function ActivityTypePicker({ value, onChange }: ActivityTypePickerProps) {
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(selected ? undefined : opt.value)}
            className={`flex-1 items-center rounded-xl border px-2 py-3 active:opacity-80 ${
              selected ? 'border-primary bg-primary/20' : 'border-light-border dark:border-gray-700'
            }`}>
            <Typography variant="body-14" color="primary">
              {opt.icon}
            </Typography>
            <Typography
              variant="body-12"
              color={selected ? 'primary' : 'secondary'}
              className="mt-1">
              {opt.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}
