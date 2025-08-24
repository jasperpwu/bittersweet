import React, { FC } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../ui/Typography';

interface DateSelectorProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  weekDates: Date[];
  onPreviousWeek?: () => void;
  onNextWeek?: () => void;
  currentWeekStart: Date;
}

export const DateSelector: FC<DateSelectorProps> = ({
  selectedDate,
  onDateSelect,
  weekDates,
  onPreviousWeek,
  onNextWeek,
  currentWeekStart,
}) => {
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const isCurrentWeek = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - daysFromMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    
    return currentWeekStart.toDateString() === thisWeekStart.toDateString();
  };

  const getWeekLabel = () => {
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(currentWeekStart.getDate() + 6);
    
    if (isCurrentWeek()) {
      return 'This Week';
    }
    
    const today = new Date();
    const lastWeekStart = new Date(today);
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    lastWeekStart.setDate(today.getDate() - daysFromMonday - 7);
    lastWeekStart.setHours(0, 0, 0, 0);
    
    if (currentWeekStart.toDateString() === lastWeekStart.toDateString()) {
      return 'Last Week';
    }
    
    // For other weeks, show the date range
    const startMonth = currentWeekStart.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = endOfWeek.toLocaleDateString('en-US', { month: 'short' });
    
    if (startMonth === endMonth) {
      return `${startMonth} ${currentWeekStart.getDate()}-${endOfWeek.getDate()}`;
    } else {
      return `${startMonth} ${currentWeekStart.getDate()} - ${endMonth} ${endOfWeek.getDate()}`;
    }
  };

  return (
    <View className="py-4">
      {/* Week Navigation Header */}
      <View className="flex-row items-center justify-between px-4 mb-3">
        <Pressable
          onPress={onPreviousWeek}
          className="p-2 rounded-lg bg-gray-700 active:opacity-70"
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </Pressable>
        
        <Typography variant="subtitle-16" color="primary" className="font-semibold">
          {getWeekLabel()}
        </Typography>
        
        <Pressable
          onPress={onNextWeek}
          className="p-2 rounded-lg bg-gray-700 active:opacity-70"
        >
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Date Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="px-4"
      >
        {weekDates.map((date, index) => (
          <Pressable
            key={index}
            onPress={() => onDateSelect(date)}
            className={`mr-4 p-3 rounded-xl min-w-16 items-center ${
              isSelected(date) 
                ? 'bg-primary' 
                : isToday(date) 
                ? 'bg-gray-600' 
                : 'bg-gray-700'
            }`}
          >
            <Typography 
              variant="body-12" 
              color={isSelected(date) ? 'white' : 'secondary'}
              className="mb-1"
            >
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
            </Typography>
            <Typography 
              variant="subtitle-14-semibold" 
              color={isSelected(date) ? 'white' : 'white'}
            >
              {date.getDate()}
            </Typography>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};