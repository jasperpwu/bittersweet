import React, { FC } from 'react';
import { View, ScrollView } from 'react-native';
import { Typography } from '../../ui/Typography';

interface CalendarDay {
  date: Date;
  focusMinutes: number;
  sessionsCompleted: number;
  isToday: boolean;
  isSelected: boolean;
}

interface CalendarViewProps {
  days: CalendarDay[];
  onDaySelect: (date: Date) => void;
  viewMode: 'week' | 'month';
  onViewModeChange: (mode: 'week' | 'month') => void;
}


export const CalendarView: FC<CalendarViewProps> = ({
  days,
  onDaySelect,
  viewMode,
  onViewModeChange,
}) => {
  const formatDate = (date: Date) => {
    return date.getDate().toString();
  };

  const getDayIntensity = (focusMinutes: number) => {
    if (focusMinutes === 0) return 'bg-light-border dark:bg-dark-border';
    if (focusMinutes < 30) return 'bg-primary/20';
    if (focusMinutes < 60) return 'bg-primary/40';
    if (focusMinutes < 120) return 'bg-primary/60';
    return 'bg-primary';
  };

  return (
    <View className="bg-white dark:bg-dark-bg">
      {/* Calendar Header */}
      <View className="flex-row justify-between items-center px-4 py-3 border-b border-light-border dark:border-dark-border">
        <Typography variant="headline-18" color="primary">
          {viewMode === 'week' ? 'This Week' : 'This Month'}
        </Typography>
        <View className="flex-row space-x-2">
          {(['week', 'month'] as const).map((mode) => (
            <View
              key={mode}
              className={`
                px-3 py-1 rounded-full
                ${viewMode === mode ? 'bg-primary' : 'bg-light-bg dark:bg-dark-bg'}
              `}
              onTouchEnd={() => onViewModeChange(mode)}
            >
              <Typography 
                variant="body-12" 
                color={viewMode === mode ? 'white' : 'primary'}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Typography>
            </View>
          ))}
        </View>
      </View>

      {/* Calendar Grid */}
      <ScrollView className="p-4">
        <View className="flex-row flex-wrap justify-between">
          {days.map((day, index) => (
            <View
              key={index}
              className={`
                w-10 h-10 rounded-lg mb-2 items-center justify-center
                ${getDayIntensity(day.focusMinutes)}
                ${day.isSelected ? 'border-2 border-primary' : ''}
                ${day.isToday ? 'border border-success' : ''}
              `}
              onTouchEnd={() => onDaySelect(day.date)}
            >
              <Typography 
                variant="body-12" 
                color={day.focusMinutes > 60 ? 'white' : 'primary'}
              >
                {formatDate(day.date)}
              </Typography>
              {day.sessionsCompleted > 0 && (
                <View className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full" />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};