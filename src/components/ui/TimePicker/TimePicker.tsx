import React, { FC, useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../Typography';

interface TimePickerProps {
  value: Date;
  onChange: (time: Date) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
}

export const TimePicker: FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  error,
  disabled = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    
    if (selectedTime) {
      onChange(selectedTime);
    }
  };

  const handlePress = () => {
    if (!disabled) {
      setShowPicker(true);
    }
  };

  return (
    <View className="w-full">
      {label && (
        <Typography variant="subtitle-14-medium" color="white" className="mb-2">
          {label}
        </Typography>
      )}
      
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        className={`
          flex-row items-center justify-between
          bg-transparent border border-dark-border
          rounded-xl px-4 py-3 min-h-12
          ${disabled ? 'opacity-50' : 'active:opacity-80'}
          ${error ? 'border-error' : ''}
        `}
        accessibilityRole="button"
        accessibilityLabel={`Select time, currently ${formatTime(value)}`}
        accessibilityHint="Double tap to open time picker"
      >
        <Typography variant="body-14" color="white">
          {formatTime(value)}
        </Typography>
        
        <Ionicons 
          name="time-outline" 
          size={20} 
          color="#6592E9" 
        />
      </Pressable>

      {error && (
        <Typography variant="body-12" color="error" className="mt-1">
          {error}
        </Typography>
      )}

      {showPicker && (
        <DateTimePicker
          value={value}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
          textColor="#FFFFFF"
          accentColor="#6592E9"
        />
      )}
    </View>
  );
};