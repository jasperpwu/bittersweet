import React from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';

type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';

interface GenderPickerProps {
  value: Gender | null;
  onChange: (gender: Gender | null) => void;
}

const OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Non-binary', value: 'non-binary' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
];

export const GenderPicker: React.FC<GenderPickerProps> = ({ value, onChange }) => {
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
                : 'bg-light-border/30 dark:bg-[#242540]'
            } active:opacity-70`}
          >
            <Typography
              variant="body-14"
              color={isSelected ? 'white' : 'primary'}
            >
              {option.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
};
