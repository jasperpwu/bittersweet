import React, { FC, useState } from 'react';
import { View, Pressable, Platform, Modal } from 'react-native';
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
  const [tempValue, setTempValue] = useState(value);

  // Sync temp value when picker opens
  React.useEffect(() => {
    if (showPicker) setTempValue(value);
  }, [showPicker, value]);

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
      if (selectedTime) {
        onChange(selectedTime);
      }
    } else {
      if (selectedTime) {
        setTempValue(selectedTime);
      }
    }
  };

  const handleConfirm = () => {
    setShowPicker(false);
    onChange(tempValue);
  };

  const handleCancel = () => {
    setShowPicker(false);
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
        Platform.OS === 'ios' ? (
          <Modal transparent visible={showPicker} animationType="fade">
            <View className="flex-1 bg-black/60 justify-center items-center px-6">
              <View className="bg-dark-bg rounded-3xl p-6 w-full max-w-sm border border-dark-border">
                <Typography variant="headline-20" color="white" className="mb-4 text-center">
                  Select Time
                </Typography>
                <DateTimePicker
                  value={tempValue}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  textColor="#FFFFFF"
                  accentColor="#6592E9"
                />
                <View className="flex-row justify-end mt-6 gap-3">
                  <Pressable 
                    onPress={handleCancel} 
                    className="flex-1 bg-gray-700 rounded-xl py-3 items-center justify-center active:opacity-80"
                  >
                    <Typography variant="subtitle-14-semibold" color="white">Cancel</Typography>
                  </Pressable>
                  <Pressable 
                    onPress={handleConfirm} 
                    className="flex-1 bg-[#6592E9] rounded-xl py-3 items-center justify-center active:opacity-80"
                  >
                    <Typography variant="subtitle-14-semibold" color="white">Confirm</Typography>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={value}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )
      )}
    </View>
  );
};