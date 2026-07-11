import React from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';
import { useTranslation } from 'react-i18next';

type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

interface GenderPickerProps {
  value: Gender | null;
  onChange: (gender: Gender | null) => void;
}

const OPTIONS: { labelKey: string; value: Gender }[] = [
  { labelKey: 'gender.male', value: 'male' },
  { labelKey: 'gender.female', value: 'female' },
  { labelKey: 'gender.nonBinary', value: 'non-binary' },
  { labelKey: 'gender.preferNotToSay', value: 'prefer-not-to-say' },
];

export const GenderPicker: React.FC<GenderPickerProps> = ({ value, onChange }) => {
  const { t } = useTranslation();
  return (
    <View className="flex-row flex-wrap gap-2">
      {OPTIONS.map((option) => {
        const isSelected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(isSelected ? null : option.value)}
            className={`px-4 py-2 rounded-full ${
              isSelected
                ? 'bg-primary'
                : 'bg-light-border/30 dark:bg-dark-card'
            } active:opacity-70`}
          >
            <Typography
              variant="body-14"
              color={isSelected ? 'white' : 'primary'}
            >
              {t(option.labelKey)}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
};
