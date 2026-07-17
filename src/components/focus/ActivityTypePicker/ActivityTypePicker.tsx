import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui';
import type { ActivityType } from '../../../utils/focusRating';

const OPTIONS: { value: ActivityType; labelKey: string; icon: string }[] = [
  { value: 'stationary', labelKey: 'home.activityStationary', icon: '🪑' },
  { value: 'on_phone', labelKey: 'home.activityOnPhone', icon: '📱' },
  { value: 'active', labelKey: 'home.activityActive', icon: '🏃' },
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
  const { t } = useTranslation();
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(selected ? undefined : opt.value)}
            className={`flex-1 items-center rounded-xl border px-2 py-3 active:opacity-80 ${
              selected
                ? 'border-primary bg-primary/20'
                : 'border-light-border dark:border-dark-border'
            }`}>
            <Typography variant="body-14" color="primary">
              {opt.icon}
            </Typography>
            <Typography
              variant="body-12"
              color={selected ? 'primary' : 'secondary'}
              className="mt-1">
              {t(opt.labelKey)}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}
