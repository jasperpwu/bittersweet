import React, { FC, useState } from 'react';
import { View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { BottomSheet } from '../../ui/BottomSheet';
import { Typography } from '../../ui/Typography';
import { FocusGoalForm } from '../../forms/FocusGoalForm';
import { useFocus, useFocusActions } from '../../../store';
import { useSubscriptionGate } from '../../../hooks/useSubscriptionGate';

interface GoalConfigModalProps {
  isVisible: boolean;
  onClose: () => void;
  editingGoalId?: string | null;
  tagId?: string; // for activation flow — the tag the goal belongs to
  onUpgrade?: () => void;
}

export const GoalConfigModal: FC<GoalConfigModalProps> = ({
  isVisible,
  onClose,
  editingGoalId = null,
  tagId,
  onUpgrade,
}) => {
  const [internalEditingGoal, setInternalEditingGoal] = useState<string | null>(null);

  // Get data from focus store
  const { goals, tags } = useFocus();
  const { updateGoal } = useFocusActions();
  const { canActivateGoal } = useSubscriptionGate();

  // Use external editingGoalId if provided, otherwise internal state
  const activeEditingGoalId = editingGoalId || internalEditingGoal;

  // Determine the goal being edited or activated
  const editingGoal = activeEditingGoalId ? goals.byId[activeEditingGoalId] : undefined;

  // Get the tag for name derivation
  const resolvedTagId = tagId || editingGoal?.tagId;
  const tag = resolvedTagId ? tags.byId[resolvedTagId] : undefined;

  // Determine if this is an activation (goal exists but is inactive)
  const isActivating = editingGoal && !editingGoal.isActive;

  // Reset state when modal opens
  React.useEffect(() => {
    if (isVisible) {
      setInternalEditingGoal(editingGoalId || null);
    }
  }, [isVisible, editingGoalId]);

  const handleSubmit = (goalData: {
    customName?: string;
    activePeriod: 'daily' | 'weekly' | 'monthly';
    dailyTargetMinutes: number;
    dailyRestDayTargetMinutes: number;
    weeklyTargetMinutes: number;
    monthlyTargetMinutes: number;
    isRepeating: boolean;
    showTotalHours: boolean;
  }) => {
    if (!activeEditingGoalId) {
      onClose();
      return;
    }

    // Check subscription gate for activation
    if (isActivating && !canActivateGoal) {
      onClose();
      onUpgrade?.();
      return;
    }

    // Update the goal (goals are auto-created, so we always update)
    updateGoal(activeEditingGoalId, {
      ...goalData,
      isActive: true, // activating or keeping active
    } as any);

    setInternalEditingGoal(null);
    onClose();
  };

  const title = isActivating ? 'Activate Goal' : 'Edit Goal';

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose}>
      {/* Header */}
      <View className="mb-6 flex-row items-center justify-between">
        <Typography variant="headline-20" color="primary">
          {title}
        </Typography>
        <Pressable onPress={onClose} className="p-2 active:opacity-70">
          <Typography variant="headline-18" color="secondary">
            ✕
          </Typography>
        </Pressable>
      </View>

      {/* Form Content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <FocusGoalForm
            onSubmit={handleSubmit}
            onCancel={onClose}
            editingGoal={editingGoal}
            tagName={tag?.name}
            tagIcon={tag?.icon}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
};
