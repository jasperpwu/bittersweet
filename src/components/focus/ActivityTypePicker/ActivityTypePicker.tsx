import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui';
import {
  DEFAULT_ACTIVITY_TYPE,
  normalizeActivityType,
  type ActivityType,
} from '../../../utils/focusRating';

// Self-rated sits last: the two motion-graded types read as a pair, and it's the
// odd one out (and the default), so it reads better as the fallback at the end.
const OPTIONS: { value: ActivityType; labelKey: string; icon: string }[] = [
  { value: 'stationary', labelKey: 'home.activityStationary', icon: '🪑' },
  { value: 'active', labelKey: 'home.activityActive', icon: '🏃' },
  { value: 'self_rated', labelKey: 'home.activitySelfRated', icon: '📝' },
];

interface ActivityTypePickerProps {
  value?: ActivityType;
  onChange: (value: ActivityType | undefined) => void;
}

/**
 * 3-way picker for a tag's activity type — how motion maps to the suggested
 * focus rating.
 *
 * An unset type already behaves as `self_rated`, so that option renders selected
 * when `value` is undefined rather than leaving an invisible fourth state that
 * rates identically but looks unpicked. Tapping it just makes the existing
 * behaviour explicit; there is deliberately no tap-to-clear, since "cleared" and
 * "self-rated" are the same thing to the rating engine.
 */
export function ActivityTypePicker({ value, onChange }: ActivityTypePickerProps) {
  const { t } = useTranslation();
  const effective = normalizeActivityType(value) ?? DEFAULT_ACTIVITY_TYPE;
  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {OPTIONS.map((opt) => {
        const selected = effective === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
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
