import React from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';
import { useTranslation } from 'react-i18next';

interface PeriodToggleProps {
  period: 'week' | 'month';
  onPeriodChange: (period: 'week' | 'month') => void;
}

export const PeriodToggle: React.FC<PeriodToggleProps> = ({ period, onPeriodChange }) => {
  const { t } = useTranslation();
  return (
    <View className="flex-row bg-light-border/30 dark:bg-dark-card rounded-xl p-1">
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
          {t('groveUI.week')}
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
          {t('groveUI.month')}
        </Typography>
      </Pressable>
    </View>
  );
};
