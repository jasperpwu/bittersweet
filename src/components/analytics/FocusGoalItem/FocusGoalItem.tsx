import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { useFocus } from '../../../store';
import { FocusGoal } from '../../../store/types';
import { getGoalCurrentTarget } from '../../../utils/goalProgress';

interface FocusGoalItemProps {
  goal: FocusGoal;
  onEdit?: (goalId: string) => void;
  onDelete?: (goalId: string) => void;
}

export const FocusGoalItem: FC<FocusGoalItemProps> = ({
  goal,
  onEdit,
  onDelete,
}) => {
  const { tags } = useFocus();
  const tag = goal.tagId ? tags.byId[goal.tagId] : null;

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    }
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  };

  const period = (goal as any).activePeriod || (goal as any).period || 'daily';
  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
  const target = getGoalCurrentTarget(goal);
  const displayName = goal.customName || (tag ? `${tag.icon} ${tag.name} Goal` : 'Goal');

  return (
    <Card className="p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Typography variant="body-14" color="primary">
            {displayName}
          </Typography>
          <Typography variant="body-12" color="secondary" className="mt-1">
            {periodLabel} · {formatTime(target)}
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

      {/* Tag */}
      {tag && (
        <View className="flex-row flex-wrap mt-2">
          <View
            className="flex-row items-center rounded-full px-2 py-1"
            style={{ backgroundColor: tag.color || '#6592E9' }}
          >
            <Typography variant="tiny-10" className="mr-1">
              {tag.icon}
            </Typography>
            <Typography variant="tiny-10" className="text-white font-poppins-medium">
              {tag.name}
            </Typography>
          </View>
        </View>
      )}
    </Card>
  );
};
