import React from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';
import { PeriodToggle } from './PeriodToggle';
import { LeaderboardRow } from './LeaderboardRow';
import type { RankingItem } from '../../services/grove/GroveRankingService';

interface LeaderboardProps {
  rankings: RankingItem[];
  period: 'week' | 'month';
  onPeriodChange: (period: 'week' | 'month') => void;
  onFriendPress?: (userId: string) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  rankings,
  period,
  onPeriodChange,
  onFriendPress,
}) => {
  const maxMinutes = rankings.length > 0 ? Math.max(...rankings.map(r => r.totalMinutes)) : 0;
  const currentUserRank = rankings.find(r => r.isCurrentUser);

  return (
    <View>
      {/* Header + Period Toggle */}
      <View className="px-5 mb-3">
        <View className="flex-row items-center justify-between mb-3">
          <Typography variant="subtitle-16" color="primary">
            Leaderboard
          </Typography>
        </View>
        <PeriodToggle period={period} onPeriodChange={onPeriodChange} />
      </View>

      {/* Content */}
      {rankings.length === 0 ? (
        <View className="py-8 items-center px-5">
          <Typography variant="body-14" color="secondary" className="text-center">
            No focus sessions shared this {period}. Start a session to appear on the leaderboard!
          </Typography>
        </View>
      ) : (
        <View className="mx-5 bg-light-border/30 dark:bg-[#242540] rounded-2xl overflow-hidden">
          {rankings.map((item, index) => (
            <View key={item.userId}>
              {index > 0 && (
                <View className="h-px bg-light-border/50 dark:bg-[#2A2B45] mx-4" />
              )}
              <LeaderboardRow
                item={item}
                maxMinutes={maxMinutes}
                onPress={!item.isCurrentUser && onFriendPress ? () => onFriendPress(item.userId) : undefined}
              />
            </View>
          ))}
        </View>
      )}

      {/* Your rank footer (if user is beyond top 5 or not visible) */}
      {currentUserRank && rankings.length > 5 && currentUserRank.rank > 5 && (
        <View className="mx-5 mt-2 bg-primary/10 rounded-xl px-4 py-3">
          <Typography variant="body-12" color="secondary">
            Your rank: #{currentUserRank.rank}
          </Typography>
        </View>
      )}
    </View>
  );
};
