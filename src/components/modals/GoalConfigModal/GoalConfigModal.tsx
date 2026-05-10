import React, { FC, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { BottomSheet } from '../../ui/BottomSheet';
import { Typography } from '../../ui/Typography';
import { FocusGoalForm } from '../../forms/FocusGoalForm';
import { useFocus, useFocusActions } from '../../../store';

interface GoalConfigModalProps {
  isVisible: boolean;
  onClose: () => void;
  editingGoalId?: string | null;
}

export const GoalConfigModal: FC<GoalConfigModalProps> = ({
  isVisible,
  onClose,
  editingGoalId = null,
}) => {
  const [internalEditingGoal, setInternalEditingGoal] = useState<string | null>(null);

  // Get data from focus store
  const { goals } = useFocus();
  const { addGoal, updateGoal } = useFocusActions();

  // Use external editingGoalId if provided, otherwise internal state
  const activeEditingGoal = editingGoalId || internalEditingGoal;

  // Reset state when modal opens
  React.useEffect(() => {
    if (isVisible) {
      setInternalEditingGoal(editingGoalId || null);
    }
  }, [isVisible, editingGoalId]);

  const handleCreateGoal = (goalData: {
    name: string;
    targetMinutes: number;
    period: 'daily' | 'weekly' | 'monthly';
    tagIds: string[];
    isRepeating: boolean;
    showTotalHours: boolean;
  }) => {
    const goalPayload = {
      name: goalData.name,
      targetMinutes: goalData.targetMinutes,
      period: goalData.period,
      tagIds: goalData.tagIds,
      isRepeating: goalData.isRepeating,
      showTotalHours: goalData.showTotalHours,
    };

    if (activeEditingGoal) {
      // Update existing goal
      updateGoal(activeEditingGoal, goalPayload as Parameters<typeof updateGoal>[1]);
    } else {
      // Add new goal to store
      addGoal({
        ...goalPayload,
        userId: 'dev-user',
        isActive: true,
        currentProgress: 0,
        lastResetDate: new Date(),
      } as unknown as Parameters<typeof addGoal>[0]);
    }

    setInternalEditingGoal(null);
    onClose();
  };

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose}>
      {/* Header */}
      <View className="mb-6 flex-row items-center justify-between">
        <Typography variant="headline-20" color="white">
          {activeEditingGoal ? 'Edit Focus Goal' : 'New Focus Goal'}
        </Typography>
        <Pressable onPress={onClose} className="p-2 active:opacity-70">
          <Typography variant="headline-18" color="secondary">
            ✕
          </Typography>
        </Pressable>
      </View>

      {/* Form Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <FocusGoalForm
          onSubmit={handleCreateGoal}
          onCancel={onClose}
          editingGoal={activeEditingGoal ? goals.byId[activeEditingGoal] : undefined}
        />
      </ScrollView>
    </BottomSheet>
  );
};
