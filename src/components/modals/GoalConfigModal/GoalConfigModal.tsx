import React, { FC, useCallback, useRef, useState } from 'react';
import { Alert, View, Pressable, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [internalEditingGoal, setInternalEditingGoal] = useState<string | null>(null);
  const { height: screenHeight } = useWindowDimensions();

  // Tracks unsaved-changes state reported by the form, so a swipe/backdrop/✕
  // dismiss can confirm before discarding (mirrors the Journal TODO sheet).
  const isDirtyRef = useRef(false);
  const handleDirtyChange = useCallback((dirty: boolean) => {
    isDirtyRef.current = dirty;
  }, []);

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
    activePeriod: 'daily' | 'weekly' | 'monthly' | 'none';
    dailyTargetMinutes: number;
    dailyRestDayTargetMinutes: number;
    weeklyTargetMinutes: number;
    monthlyTargetMinutes: number;
    totalTargetMinutes: number;
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

  const title = isActivating ? t('goals.activateGoal') : t('goals.editTitle');

  // Prompt before throwing away unsaved edits; the Discard button drives the
  // actual close. Returns false to tell BottomSheet to keep the sheet open.
  const promptDiscard = () => {
    Alert.alert(t('goals.discardTitle'), t('goals.discardMessage'), [
      { text: t('goals.keepEditing'), style: 'cancel' },
      { text: t('goals.discard'), style: 'destructive', onPress: onClose },
    ]);
  };

  // Guard for BottomSheet (swipe / backdrop / hardware back): allow the close
  // only when there's nothing unsaved.
  const handleBeforeClose = (): boolean => {
    if (!isDirtyRef.current) return true;
    promptDiscard();
    return false;
  };

  // Guard for the explicit close (✕ / Cancel) buttons.
  const handleClosePress = () => {
    if (isDirtyRef.current) promptDiscard();
    else onClose();
  };

  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      height={screenHeight * 0.85}
      scrollable
      beforeClose={handleBeforeClose}>
      {/* Header */}
      <View className="mb-6 flex-row items-center justify-between">
        <Typography variant="headline-20" color="primary">
          {title}
        </Typography>
        <Pressable onPress={handleClosePress} className="p-2 active:opacity-70">
          <Typography variant="headline-18" color="secondary">
            ✕
          </Typography>
        </Pressable>
      </View>

      {/* Form Content */}
      <FocusGoalForm
        onSubmit={handleSubmit}
        onCancel={handleClosePress}
        editingGoal={editingGoal}
        tagName={tag?.name}
        tagIcon={tag?.icon}
        onDirtyChange={handleDirtyChange}
      />
    </BottomSheet>
  );
};
