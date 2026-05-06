import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';

interface FocusGoalItemProps {
  goal: {
    id: string;
    name: string;
    targetMinutes: number;
    period: 'daily' | 'weekly' | 'monthly';
    tagNames: string[];
    isActive: boolean;
  };
  onEdit?: (goalId: string) => void;
  onDelete?: (goalId: string) => void;
}

export const FocusGoalItem: FC<FocusGoalItemProps> = ({
  goal,
  onEdit,
  onDelete,
}) => {
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    }
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  const getPeriodLabel = (period: string): string => {
    return period.charAt(0).toUpperCase() + period.slice(1);
  };

  return (
    <Card className="p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Typography variant="body-14" color="white">
            {goal.name}
          </Typography>
          <Typography variant="body-12" color="secondary" className="mt-1">
            {getPeriodLabel(goal.period)} · {formatTime(goal.targetMinutes)}
          </Typography>
        </View>
        <View className="flex-row items-center space-x-2">
          {(onEdit || onDelete) && (
            <View className="flex-row">
              {onEdit && (
                <Pressable
                  onPress={() => onEdit(goal.id)}
                  className="p-1 active:opacity-70"
                >
                  <Typography variant="body-12" className="text-link">
                    Edit
                  </Typography>
                </Pressable>
              )}
              {onDelete && (
                <Pressable
                  onPress={() => onDelete(goal.id)}
                  className="p-1 active:opacity-70 ml-2"
                >
                  <Typography variant="body-12" className="text-red-400">
                    Delete
                  </Typography>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Tags */}
      {goal.tagNames.length > 0 && (
        <View className="flex-row flex-wrap mt-2">
          {goal.tagNames.map((tag) => (
            <View
              key={tag}
              className="bg-primary/20 rounded-full px-2 py-1 mr-2 mt-1"
            >
              <Typography variant="tiny-10" className="text-primary">
                {tag}
              </Typography>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
};
