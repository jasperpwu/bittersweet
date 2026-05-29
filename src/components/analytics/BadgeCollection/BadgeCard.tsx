import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Badge } from '../../../store/types';

interface BadgeCardProps {
  badge: Badge;
  onPress: () => void;
}

export const BadgeCard: FC<BadgeCardProps> = ({ badge, onPress }) => {
  const totalHours = Math.floor(badge.totalMinutes / 60);
  const dateRange = `${badge.startDate} — ${badge.endDate}`;

  // Find the longest streak across all period stats
  const longestStreak = Math.max(
    badge.dailyStats?.longestStreak || 0,
    badge.weeklyStats?.longestStreak || 0,
    badge.monthlyStats?.longestStreak || 0,
  );

  return (
    <Pressable onPress={onPress} className="active:opacity-80">
      <View
        className="rounded-xl p-4 items-center"
        style={{ backgroundColor: badge.tagColor + '20', borderColor: badge.tagColor, borderWidth: 1 }}
      >
        {/* Large emoji */}
        <Typography variant="headline-24" className="mb-2">
          {badge.tagIcon}
        </Typography>

        {/* Tag name */}
        <Typography
          variant="subtitle-16"
          className="text-light-text-primary dark:text-dark-text-primary text-center font-poppins-semibold"
          numberOfLines={1}
        >
          {badge.tagName}
        </Typography>

        {/* Total hours */}
        <Typography variant="body-12" color="secondary" className="mt-1">
          {totalHours}h total
        </Typography>

        {/* Streak */}
        {longestStreak > 0 && (
          <Typography variant="body-12" color="secondary">
            {longestStreak} streak
          </Typography>
        )}

        {/* Date range */}
        <Typography variant="tiny-10" color="secondary" className="mt-1 text-center" numberOfLines={1}>
          {dateRange}
        </Typography>
      </View>
    </Pressable>
  );
};
