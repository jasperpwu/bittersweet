import React, { FC, useState } from 'react';
import { Alert, View, ScrollView, Pressable } from 'react-native';
import { BottomSheet } from '../../ui/BottomSheet';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { FocusGoalItem } from '../../analytics/FocusGoalItem';
import { FocusGoalForm } from '../../forms/FocusGoalForm';
import { useFocus, useFocusActions } from '../../../store';

interface GoalConfigModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export const GoalConfigModal: FC<GoalConfigModalProps> = ({ isVisible, onClose }) => {
  const [activeTab, setActiveTab] = useState<'focus' | 'custom'>('focus');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);

  // Get data from focus store
  const { goals } = useFocus();
  const { addGoal, updateGoal, deleteGoal } = useFocusActions();

  // Get goals from store
  const storeGoals = React.useMemo(
    () => goals.allIds.map((goalId) => goals.byId[goalId]).filter((goal) => goal?.isActive),
    [goals.allIds, goals.byId]
  );

  // Reset state when modal opens
  React.useEffect(() => {
    if (isVisible) {
      setActiveTab('focus');
      setShowGoalForm(false);
      setEditingGoal(null);
    }
  }, [isVisible]);

  const handleCreateGoal = (goalData: {
    name: string;
    targetMinutes: number;
    period: 'daily' | 'weekly' | 'monthly';
    tagNames: string[];
    isRepeating: boolean;
    showTotalHours: boolean;
  }) => {
    const goalPayload = {
      name: goalData.name,
      targetMinutes: goalData.targetMinutes,
      period: goalData.period,
      tagNames: goalData.tagNames,
      isRepeating: goalData.isRepeating,
      showTotalHours: goalData.showTotalHours,
    };

    if (editingGoal) {
      // Update existing goal
      updateGoal(editingGoal, goalPayload as Parameters<typeof updateGoal>[1]);
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

    setShowGoalForm(false);
    setEditingGoal(null);
  };

  const handleEditGoal = (goalId: string) => {
    setEditingGoal(goalId);
    setShowGoalForm(true);
  };

  const getGoalTagNames = (goal: unknown) => {
    const tagNames = (goal as { tagNames?: unknown }).tagNames;
    return Array.isArray(tagNames)
      ? tagNames.filter((tagName): tagName is string => typeof tagName === 'string')
      : [];
  };

  const handleDeleteGoal = (goalId: string) => {
    const goalName = goals.byId[goalId]?.name ?? 'this goal';

    Alert.alert(
      'Delete goal?',
      `Delete "${goalName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteGoal(goalId),
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose}>
      {/* Header */}
      <View className="mb-6 flex-row items-center justify-between">
        <Typography variant="headline-20" color="white">
          Goal Settings
        </Typography>
        <Pressable onPress={onClose} className="p-2 active:opacity-70">
          <Typography variant="headline-18" color="secondary">
            ✕
          </Typography>
        </Pressable>
      </View>

      {/* Tab Navigation */}
      <View className="mb-6 flex-row rounded-lg bg-dark-border p-1">
        <Pressable
          onPress={() => setActiveTab('focus')}
          className={`flex-1 rounded-md px-4 py-2 ${
            activeTab === 'focus' ? 'bg-primary' : 'bg-transparent'
          }`}>
          <Typography
            variant="body-14"
            className={`text-center ${activeTab === 'focus' ? 'text-white' : 'text-white'}`}>
            Focus Goals
          </Typography>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('custom')}
          className={`flex-1 rounded-md px-4 py-2 ${
            activeTab === 'custom' ? 'bg-primary' : 'bg-transparent'
          }`}>
          <Typography
            variant="body-14"
            className={`text-center ${activeTab === 'custom' ? 'text-white' : 'text-white'}`}>
            Habits & Streaks
          </Typography>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {activeTab === 'focus' ? (
          showGoalForm ? (
            <View className="space-y-4">
              {/* Form Header with Back Button */}
              <View className="mb-4 flex-row items-center">
                <Pressable
                  onPress={() => {
                    setShowGoalForm(false);
                    setEditingGoal(null);
                  }}
                  className="mr-3 p-1 active:opacity-70">
                  <Typography variant="headline-18" color="primary">
                    ←
                  </Typography>
                </Pressable>
                <Typography variant="subtitle-16" color="white">
                  {editingGoal ? 'Edit Focus Goal' : 'Create New Focus Goal'}
                </Typography>
              </View>

              <FocusGoalForm
                onSubmit={handleCreateGoal}
                onCancel={() => {
                  setShowGoalForm(false);
                  setEditingGoal(null);
                }}
                editingGoal={editingGoal ? goals.byId[editingGoal] : undefined}
              />
            </View>
          ) : (
            <View className="space-y-4">
              {/* Current Focus Goals */}
              <View className="mb-4">
                <Typography variant="subtitle-16" color="white" className="mb-3">
                  Current Goals
                </Typography>

                {storeGoals.length > 0 ? (
                  <View className="space-y-3">
                    {storeGoals.map((goal) => (
                      <FocusGoalItem
                        key={goal.id}
                        goal={{
                          id: goal.id,
                          name: goal.name,
                          targetMinutes: goal.targetMinutes,
                          period: goal.period,
                          tagNames: getGoalTagNames(goal),
                          isActive: goal.isActive,
                        }}
                        onEdit={handleEditGoal}
                        onDelete={handleDeleteGoal}
                      />
                    ))}
                  </View>
                ) : (
                  <Card className="items-center p-6">
                    <Typography variant="body-14" color="secondary" className="text-center">
                      No focus goals set yet.{'\n'}Create your first goal to start tracking!
                    </Typography>
                  </Card>
                )}
              </View>

              {/* Add New Goal Button */}
              <Pressable
                onPress={() => setShowGoalForm(true)}
                className="rounded-xl bg-primary p-4 active:opacity-80">
                <Typography variant="body-14" className="text-center text-white">
                  + Add New Focus Goal
                </Typography>
              </Pressable>
            </View>
          )
        ) : (
          /* Habits & Streaks Tab */
          <View className="space-y-4">
            <Typography variant="subtitle-16" color="white" className="mb-3">
              Habits & Streaks
            </Typography>

            <Card className="items-center p-6">
              <Typography variant="body-14" color="white" className="mb-2">
                🏆
              </Typography>
              <Typography variant="body-14" color="white" className="mb-2 text-center">
                Habits & Streaks Coming Soon
              </Typography>
              <Typography variant="body-14" color="secondary" className="mb-4 text-center">
                Track daily habits, maintain streaks, and build consistency over time.
              </Typography>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View className="flex-row justify-end border-t border-dark-border pt-4">
        <Pressable
          onPress={onClose}
          className="rounded-lg bg-dark-border px-6 py-2 active:opacity-70">
          <Typography variant="body-14" color="white">
            Done
          </Typography>
        </Pressable>
      </View>
    </BottomSheet>
  );
};
