import React, { FC } from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import { Typography } from '../ui/Typography';

interface DateSelectorProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  weekDates: Date[];
}

export const DateSelector: FC<DateSelectorProps> = ({
  selectedDate,
  onDateSelect,
  weekDates,
}) => {
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  return (
    <View className="py-4">
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