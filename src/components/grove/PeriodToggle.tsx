import React from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';

interface PeriodToggleProps {
  period: 'week' | 'month';
  onPeriodChange: (period: 'week' | 'month') => void;
}

export const PeriodToggle: React.FC<PeriodToggleProps> = ({ period, onPeriodChange }) => {
  return (
    <View className="flex-row bg-light-border/30 dark:bg-[#242540] rounded-xl p-1">
      <Pressable
        onPress={() => onPeriodChange('week')}
        className={`flex-1 py-2 rounded-lg items-center ${
          period === 'week' ? 'bg-primary' : ''
        }`}
      >
        <Typography
          variant="subtitle-14-medium"
          color={period === 'week' ? 'white' : 'secondary'}
        >
          Week
        </Typography>
      </Pressable>
      <Pressable
        onPress={() => onPeriodChange('month')}
        className={`flex-1 py-2 rounded-lg items-center ${
          period === 'month' ? 'bg-primary' : ''
        }`}
      >
        <Typography
          variant="subtitle-14-medium"
          color={period === 'month' ? 'white' : 'secondary'}
        >
          Month
        </Typography>
      </Pressable>
    </View>
  );
};
