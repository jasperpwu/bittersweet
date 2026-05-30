import React from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';
import type { ChallengeItem } from '../../services/grove/GroveChallengeService';

interface ChallengeCardProps {
  challenge: ChallengeItem;
  currentUserId: string;
}

function daysRemaining(endDate: string | null): number {
  if (!endDate) return 0;
  const end = new Date(endDate);
  const now = new Date();
  const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

export const ChallengeCard: React.FC<ChallengeCardProps> = ({ challenge, currentUserId }) => {
  const isChallenger = currentUserId === challenge.challengerId;
  const myStreak = isChallenger ? challenge.challengerStreak : challenge.challengeeStreak;
  const theirStreak = isChallenger ? challenge.challengeeStreak : challenge.challengerStreak;
  const theirProfile = isChallenger ? challenge.challengeeProfile : challenge.challengerProfile;
  const remaining = daysRemaining(challenge.endDate);
  const isCompleted = challenge.status === 'completed';
  const isFailed = challenge.status === 'failed';

  return (
    <View className="bg-light-border/30 dark:bg-[#242540] rounded-2xl p-4 w-[260px]">
      {/* Tag + Status */}
      <View className="flex-row items-center mb-3">
        <Typography variant="body-14" className="mr-1.5">
          {challenge.tagIcon}
        </Typography>
        <Typography variant="subtitle-14-medium" color="primary" className="flex-1" numberOfLines={1}>
          {challenge.tagName}
        </Typography>
        {isCompleted && (
          <View className="bg-green-500/20 rounded-full px-2 py-0.5">
            <Typography variant="body-12" style={{ color: '#22C55E' }}>
              Done
            </Typography>
          </View>
        )}
        {isFailed && (
          <View className="bg-red-500/20 rounded-full px-2 py-0.5">
            <Typography variant="body-12" style={{ color: '#EF4444' }}>
              Failed
            </Typography>
          </View>
        )}
      </View>

      {/* Streak progress */}
      <View className="mb-2">
        <View className="flex-row items-center justify-between mb-1">
          <Typography variant="body-12" color="secondary">
            You
          </Typography>
          <Typography variant="body-12" color="primary">
            {myStreak}/{challenge.streakDays} days
          </Typography>
        </View>
        <View className="h-2 bg-light-border/50 dark:bg-[#2A2B45] rounded-full">
          <View
            className="h-2 bg-primary rounded-full"
            style={{ width: `${Math.min((myStreak / challenge.streakDays) * 100, 100)}%` }}
          />
        </View>
      </View>

      <View className="mb-3">
        <View className="flex-row items-center justify-between mb-1">
          <Typography variant="body-12" color="secondary" numberOfLines={1}>
            {theirProfile.display_name}
          </Typography>
          <Typography variant="body-12" color="primary">
            {theirStreak}/{challenge.streakDays} days
          </Typography>
        </View>
        <View className="h-2 bg-light-border/50 dark:bg-[#2A2B45] rounded-full">
          <View
            className="h-2 bg-[#E9A065] rounded-full"
            style={{ width: `${Math.min((theirStreak / challenge.streakDays) * 100, 100)}%` }}
          />
        </View>
      </View>

      {/* Footer */}
      <View className="flex-row items-center justify-between">
        {challenge.status === 'active' && (
          <Typography variant="body-12" color="secondary">
            {remaining} {remaining === 1 ? 'day' : 'days'} left
          </Typography>
        )}
        <Typography variant="body-12" color="secondary">
          +{challenge.fruitReward} fruits
        </Typography>
      </View>
    </View>
  );
};
