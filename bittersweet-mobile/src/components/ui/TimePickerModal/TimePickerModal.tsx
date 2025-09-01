import React, { FC, useState, useEffect } from 'react';
import { View, Modal, Pressable } from 'react-native';
import { Typography } from '../Typography';
import { TimeDial } from '../TimeDial/TimeDial';

interface TimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (time: Date) => void;
  initialTime: Date;
  title: string;
  minTime?: Date;
  maxTime?: Date;
}

export const TimePickerModal: FC<TimePickerModalProps> = ({
  visible,
  onClose,
  onSave,
  initialTime,
  title,
  minTime,
  maxTime,
}) => {
  const [selectedTime, setSelectedTime] = useState(initialTime);

  // Update selectedTime when initialTime changes
  useEffect(() => {
    setSelectedTime(initialTime);
  }, [initialTime]);

  const handleSave = () => {
    onSave(selectedTime);
    onClose();
  };

  const handleCancel = () => {
    setSelectedTime(initialTime); // Reset to initial value
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable 
        className="flex-1 bg-black/60 justify-center items-center px-6"
        onPress={handleCancel}
      >
        {/* Modal Content */}
        <Pressable className="w-full max-w-sm" onPress={(e) => e.stopPropagation()}>
          <View className="bg-dark-bg rounded-3xl p-6 border border-dark-border">
            {/* Header */}
            <Typography 
              variant="headline-20" 
              className="text-dark-text-primary mb-6 text-center font-semibold"
            >
              {title}
            </Typography>
            
            {/* Time Dial */}
            <View className="items-center">
              <TimeDial
                value={selectedTime}
                onChange={setSelectedTime}
                onDone={handleSave}
                minTime={minTime}
                maxTime={maxTime}
                height={240}
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};