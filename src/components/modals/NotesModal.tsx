import React, { FC, useState } from 'react';
import { View, Modal, Pressable, Switch } from 'react-native';
import { Typography } from '../ui/Typography';
import { Input } from '../ui/Input';

interface NotesModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (notes: string, includeBonusTime: boolean) => void;
  initialNotes?: string;
  /** Whether the session had bonus (overtime) */
  hadBonusTime?: boolean;
  /** The original target duration in minutes */
  targetDurationMinutes?: number;
  /** Bonus seconds accumulated beyond the target */
  bonusSeconds?: number;
}

const formatDuration = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0 && s > 0) return `${m}m ${s}s`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

export const NotesModal: FC<NotesModalProps> = ({
  visible,
  onClose,
  onSave,
  initialNotes = '',
  hadBonusTime = false,
  targetDurationMinutes = 0,
  bonusSeconds = 0,
}) => {
  const [notes, setNotes] = useState(initialNotes);
  const [includeBonusTime, setIncludeBonusTime] = useState(true);

  const targetSeconds = targetDurationMinutes * 60;
  const totalWithBonus = targetSeconds + bonusSeconds;
  const totalWithoutBonus = targetSeconds;

  const handleSave = () => {
    onSave(notes, includeBonusTime);
    onClose();
  };

  const handleSkip = () => {
    setNotes(initialNotes);
    onSave('', includeBonusTime);
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
        onPress={handleSkip}
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

            {/* Bonus Time Toggle - only shown when session had bonus time */}
            {hadBonusTime && bonusSeconds > 0 && (
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-2">
                  <Typography variant="subtitle-14-semibold" color="white">
                    Include Bonus Time
                  </Typography>
                  <Switch
                    value={includeBonusTime}
                    onValueChange={setIncludeBonusTime}
                    trackColor={{ false: '#3A3A3C', true: '#4CAF7C' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <Typography variant="body-12" color="secondary">
                  Total: {formatDuration(includeBonusTime ? totalWithBonus : totalWithoutBonus)}
                  {includeBonusTime
                    ? ` (${formatDuration(targetSeconds)} + ${formatDuration(bonusSeconds)} bonus)`
                    : ` (bonus time excluded)`}
                </Typography>
              </View>
            )}

            {/* Buttons */}
            <View className="flex-row" style={{ gap: 12 }}>
              <Pressable
                onPress={handleSkip}
                className="flex-1 rounded-xl items-center justify-center py-3 border border-dark-border active:opacity-80"
              >
                <Typography variant="subtitle-14-semibold" color="white">
                  Skip
                </Typography>
              </Pressable>
              <Pressable
                onPress={handleSave}
                className="flex-1 rounded-xl items-center justify-center py-3 bg-white active:opacity-80"
              >
                <Typography
                  variant="subtitle-14-semibold"
                  style={{ color: '#1B1C30' }}
                >
                  Save Notes
                </Typography>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};
