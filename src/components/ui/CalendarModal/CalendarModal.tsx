import React, { FC, useState } from 'react';
import { View, Modal, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../Typography';

interface CalendarModalProps {
  visible: boolean;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
}

export const CalendarModal: FC<CalendarModalProps> = ({
  visible,
  selectedDate,
  onDateSelect,
  onClose,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatMonth = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long' });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    onDateSelect(newDate);
    onClose();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <View key={`empty-${i}`} className="w-12 h-12" />
      );
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = 
        selectedDate.getDate() === day &&
        selectedDate.getMonth() === currentMonth.getMonth() &&
        selectedDate.getFullYear() === currentMonth.getFullYear();

      days.push(
        <Pressable
          key={day}
          onPress={() => handleDateSelect(day)}
          className={`w-12 h-12 items-center justify-center rounded-full ${
            isSelected ? 'bg-primary' : ''
          }`}
        >
          <Text className={`font-poppins-regular text-body-12 ${
            isSelected ? 'text-white font-poppins-semibold' : 'text-white'
          }`}>
            {day}
          </Text>
        </Pressable>
      );
    }

    return days;
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 items-center justify-center px-5">
        <View className="bg-[#373847] rounded-lg w-full max-w-sm p-5">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Typography variant="headline-18" className="text-white">
              {formatMonth(currentMonth)}
            </Typography>
            <View className="flex-row space-x-4">
              <Pressable onPress={() => navigateMonth('prev')}>
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={() => navigateMonth('next')}>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {/* Week Days */}
          <View className="flex-row mb-4">
            {weekDays.map((day) => (
              <View key={day} className="w-12 items-center">
                <Text className="text-white font-poppins-regular text-body-12">
                  {day}
                </Text>
              </View>
            ))}
          </View>

          {/* Calendar Grid */}
          <View className="flex-row flex-wrap">
            {renderCalendar()}
          </View>
        </View>
      </View>
    </Modal>
  );
};