import React, { FC } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Typography } from '../ui/Typography';

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
  return (
    <View className="bg-white dark:bg-gray-800 border-b border-light-border dark:border-dark-border">
      {/* View Mode Toggle */}
      <View className="flex-row justify-between items-center px-4 py-3">
        <Typography variant="subtitle-16" color="primary">
          January 2024
        </Typography>
        
        <View className="flex-row bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <Pressable
            onPress={() => onViewModeChange('week')}
            className={`px-3 py-1 rounded-md ${
              viewMode === 'week' ? 'bg-primary' : ''
            }`}
          >
            <Typography 
              variant="body-12" 
              color={viewMode === 'week' ? 'white' : 'secondary'}
            >
              Week
            </Typography>
          </Pressable>
          <Pressable
            onPress={() => onViewModeChange('month')}
            className={`px-3 py-1 rounded-md ${
              viewMode === 'month' ? 'bg-primary' : ''
            }`}
          >
            <Typography 
              variant="body-12" 
              color={viewMode === 'month' ? 'white' : 'secondary'}
            >
              Month
            </Typography>
          </Pressable>
        </View>
      </View>

      {/* Calendar Days */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="px-4 pb-4"
      >
        {days.slice(0, viewMode === 'week' ? 7 : 30).map((day, index) => (
          <Pressable
            key={index}
            onPress={() => onDaySelect(day.date)}
            className={`mr-3 p-3 rounded-xl min-w-16 items-center ${
              day.isSelected 
                ? 'bg-primary' 
                : day.isToday 
                ? 'bg-gray-200 dark:bg-gray-600' 
                : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            <Typography 
              variant="body-12" 
              color={day.isSelected ? 'white' : 'secondary'}
              className="mb-1"
            >
              {day.date.toLocaleDateString('en-US', { weekday: 'short' })}
            </Typography>
            <Typography 
              variant="subtitle-14-semibold" 
              color={day.isSelected ? 'white' : 'primary'}
              className="mb-2"
            >
              {day.date.getDate()}
            </Typography>
            
            {/* Focus indicator */}
            {day.focusMinutes > 0 && (
              <View 
                className={`w-2 h-2 rounded-full ${
                  day.focusMinutes > 60 ? 'bg-success' : 'bg-primary'
                }`}
              />
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};