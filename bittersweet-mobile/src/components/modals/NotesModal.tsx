import React, { FC, useState } from 'react';
import { View, Modal, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface NotesModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (notes: string) => void;
  initialNotes?: string;
}

export const NotesModal: FC<NotesModalProps> = ({
  visible,
  onClose,
  onSave,
  initialNotes = '',
}) => {
  const [notes, setNotes] = useState(initialNotes);

  const handleSave = () => {
    onSave(notes);
    onClose();
  };

  const handleCancel = () => {
    setNotes(initialNotes); // Reset to initial value
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
        className="flex-1 bg-black/50 justify-center items-center px-6"
        onPress={handleCancel}
      >
        {/* Modal Content */}
        <Pressable className="w-full max-w-md" onPress={(e) => e.stopPropagation()}>
          <View className="bg-dark-bg rounded-xl p-6 border border-dark-border">
            {/* Header */}
            <Typography 
              variant="headline-18" 
              className="text-dark-text-primary mb-4 text-center"
            >
              Add Session Notes
            </Typography>
            
            {/* Notes Input */}
            <Input
              label="Notes (Optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="How did this session go? What did you learn?"
              multiline
              numberOfLines={4}
              className="mb-6"
              textAlignVertical="top"
            />
            
            {/* Buttons */}
            <View className="flex-row space-x-3">
              <Button
                variant="secondary"
                onPress={handleCancel}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                variant="primary"
                onPress={handleSave}
                className="flex-1"
              >
                Save Notes
              </Button>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};