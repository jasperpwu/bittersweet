import React, { FC, useState } from 'react';
import { View, Modal, Pressable } from 'react-native';
import { Typography } from '../ui/Typography';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface UnlockReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const UnlockReasonModal: FC<UnlockReasonModalProps> = ({
  visible,
  onClose,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (reason.trim().length > 0) {
      onConfirm(reason.trim());
      setReason(''); // Reset
    }
  };

  const handleCancel = () => {
    setReason(''); // Reset
    onCancel();
  };

  const handleReasonChange = (text: string) => {
    // Limit to 10 characters
    if (text.length <= 10) {
      setReason(text);
    }
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
              What are you trying to do?
            </Typography>

            {/* Reason Input */}
            <Input
              label="Reason (Max 10 characters)"
              value={reason}
              onChangeText={handleReasonChange}
              placeholder="e.g., Check msg"
              maxLength={10}
              autoFocus
              className="mb-2"
            />

            <Typography variant="tiny-10" color="secondary" className="mb-6 text-center">
              {reason.length}/10 characters
            </Typography>

            {/* Buttons */}
            <View className="flex-row space-x-3">
              <Button
                variant="secondary"
                onPress={handleCancel}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onPress={handleConfirm}
                disabled={reason.trim().length === 0}
                className="flex-1"
              >
                Unlock
              </Button>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
