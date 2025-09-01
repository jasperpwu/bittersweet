import React, { FC, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
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

export const GoalConfigModal: FC<GoalConfigModalProps> = ({
  isVisible,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'focus' | 'custom'>('focus');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<string | null>(null);

  // Get data from focus store
  const { goals } = useFocus();
  const { addGoal, updateGoal, deleteGoal, getActiveGoals } = useFocusActions();
  
  // Get goals from store
  const storeGoals = getActiveGoals();

  // Reset state when modal opens
  React.useEffect(() => {
    if (isVisible) {
      setActiveTab('focus');
      setShowGoalForm(false);
      setEditingGoal(null);
    }
  }, [isVisible]);

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getProgressPercentage = (current: number, target: number): number => {
    return Math.min((current / target) * 100, 100);
  };

  const handleCreateGoal = (goalData: {
    name: string;
    targetMinutes: number;
    period: 'daily' | 'weekly' | 'yearly';
    tagIds: string[];
  }) => {
    if (editingGoal) {
      // Update existing goal
      updateGoal(editingGoal, {
        name: goalData.name,
        targetMinutes: goalData.targetMinutes,
        period: goalData.period,
        tagIds: goalData.tagIds,
      });
    } else {
      // Add new goal to store
      addGoal({
        userId: 'dev-user',
        name: goalData.name,
        targetMinutes: goalData.targetMinutes,
        period: goalData.period,
        tagIds: goalData.tagIds,
        isActive: true,
        currentProgress: 0,
        lastResetDate: new Date(),
      });
    }
    
    setShowGoalForm(false);
    setEditingGoal(null);
  };

  const handleEditGoal = (goalId: string) => {
    setEditingGoal(goalId);
    setShowGoalForm(true);
  };

  const handleDeleteGoal = (goalId: string) => {
    deleteGoal(goalId);
  };

  return (
    <BottomSheet isVisible={isVisible} onClose={onClose}>
      {/* Header */}
      <View className="flex-row items-center justify-between mb-6">
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
      <View className="flex-row mb-6 bg-dark-border rounded-lg p-1">
          <Pressable
            onPress={() => setActiveTab('focus')}
            className={`flex-1 py-2 px-4 rounded-md ${
              activeTab === 'focus' ? 'bg-primary' : 'bg-transparent'
            }`}
          >
            <Typography
              variant="body-14"
              className={`text-center ${
                activeTab === 'focus' ? 'text-white' : 'text-gray-400'
              }`}
            >
              Focus Goals
            </Typography>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('custom')}
            className={`flex-1 py-2 px-4 rounded-md ${
              activeTab === 'custom' ? 'bg-primary' : 'bg-transparent'
            }`}
          >
            <Typography
              variant="body-14"
              className={`text-center ${
                activeTab === 'custom' ? 'text-white' : 'text-white'
              }`}
            >
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
                <View className="flex-row items-center mb-4">
                  <Pressable 
                    onPress={() => {
                      setShowGoalForm(false);
                      setEditingGoal(null);
                    }}
                    className="mr-3 p-1 active:opacity-70"
                  >
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
                            tagNames: [], // TODO: Map from tagIds to tag names
                            currentProgress: goal.currentProgress,
                            isActive: goal.isActive,
                          }}
                          onEdit={handleEditGoal}
                          onDelete={handleDeleteGoal}
                        />
                      ))}
                    </View>
                  ) : (
                    <Card className="p-6 items-center">
                      <Typography variant="body-14" color="secondary" className="text-center">
                        No focus goals set yet.{'\n'}Create your first goal to start tracking!
                      </Typography>
                    </Card>
                  )}
                </View>

                {/* Add New Goal Button */}
                <Pressable 
                  onPress={() => setShowGoalForm(true)}
                  className="bg-primary rounded-xl p-4 active:opacity-80"
                >
                  <Typography variant="body-14" className="text-white text-center">
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
              
              <Card className="p-6 items-center">
                <Typography variant="body-14" color="white" className="mb-2">
                  🏆
                </Typography>
                <Typography variant="body-14" color="white" className="mb-2 text-center">
                  Habits & Streaks Coming Soon
                </Typography>
                <Typography variant="body-14" color="secondary" className="text-center mb-4">
                  Track daily habits, maintain streaks, and build consistency over time.
                </Typography>
                
                <Pressable className="bg-dark-border rounded-xl px-4 py-2 active:opacity-70">
                  <Typography variant="body-14" color="secondary">
                    Create Habit Goal
                  </Typography>
                </Pressable>
              </Card>
            </View>
          )}
      </ScrollView>

      {/* Footer */}
      <View className="flex-row justify-end pt-4 border-t border-dark-border">
        <Pressable
          onPress={onClose}
          className="bg-dark-border rounded-lg px-6 py-2 active:opacity-70"
        >
          <Typography variant="body-14" color="white">
            Done
          </Typography>
        </Pressable>
      </View>
    </BottomSheet>
  );
};