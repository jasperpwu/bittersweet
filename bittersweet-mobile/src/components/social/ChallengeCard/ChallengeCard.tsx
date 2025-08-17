import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly';
  target: number; // target value (minutes, sessions, etc.)
  unit: 'minutes' | 'sessions' | 'days';
  progress: number; // current progress
  participants: number;
  reward: {
    seeds: number;
    badge?: string;
  };
  startDate: Date;
  endDate: Date;
  isJoined: boolean;
  isCompleted: boolean;
}

interface ChallengeCardProps {
  challenge: Challenge;
  onJoin?: (challengeId: string) => void;
  onLeave?: (challengeId: string) => void;
  onViewDetails?: (challenge: Challenge) => void;
}


export const ChallengeCard: FC<ChallengeCardProps> = ({
  challenge,
  onJoin,
  onLeave,
  onViewDetails,
}) => {
  const progressPercentage = Math.min((challenge.progress / challenge.target) * 100, 100);
  
  const formatTimeRemaining = () => {
    const now = new Date();
    const timeLeft = challenge.endDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 0) return 'Ended';
    if (daysLeft === 1) return '1 day left';
    return `${daysLeft} days left`;
  };

  const getChallengeTypeColor = () => {
    switch (challenge.type) {
      case 'daily':
        return 'bg-success/10 text-success';
      case 'weekly':
        return 'bg-primary/10 text-primary';
      case 'monthly':
        return 'bg-error/10 text-error';
      default:
        return 'bg-light-bg dark:bg-dark-bg text-primary';
    }
  };

  return (
    <Pressable 
      onPress={() => onViewDetails?.(challenge)}
      className="active:opacity-80"
    >
      <Card variant="default" padding="medium" className="mx-4 mb-4">
        {/* Header */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <View className="flex-row items-center mb-2">
              <Typography variant="subtitle-16" color="primary" className="flex-1">
                {challenge.title}
              </Typography>
              <View className={`px-2 py-1 rounded ${getChallengeTypeColor()}`}>
                <Typography variant="tiny-10">
                  {challenge.type.toUpperCase()}
                </Typography>
              </View>
            </View>
            <Typography variant="body-12" color="secondary" className="mb-2">
              {challenge.description}
            </Typography>
          </View>
        </View>

        {/* Progress */}
        <View className="mb-4">
          <View className="flex-row justify-between items-center mb-2">
            <Typography variant="body-12" color="secondary">
              Progress
            </Typography>
            <Typography variant="subtitle-14-semibold" color="primary">
              {challenge.progress} / {challenge.target} {challenge.unit}
            </Typography>
          </View>
          
          {/* Progress Bar */}
          <View className="h-2 bg-light-border dark:bg-dark-border rounded-full overflow-hidden">
            <View 
              className={`h-full rounded-full ${
                challenge.isCompleted ? 'bg-success' : 'bg-primary'
              }`}
              style={{ width: `${progressPercentage}%` }}
            />
          </View>
          
          <Typography variant="tiny-10" color="secondary" className="mt-1">
            {progressPercentage.toFixed(0)}% complete
          </Typography>
        </View>

        {/* Reward & Stats */}
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center">
            <Typography variant="body-12" color="secondary">
              Reward: 
            </Typography>
            <Typography variant="body-12" color="success" className="ml-1">
              {challenge.reward.seeds} seeds
            </Typography>
            {challenge.reward.badge && (
              <Typography variant="body-12" color="primary" className="ml-2">
                + {challenge.reward.badge}
              </Typography>
            )}
          </View>
          
          <Typography variant="body-12" color="secondary">
            {challenge.participants} participants
          </Typography>
        </View>

        {/* Footer */}
        <View className="flex-row justify-between items-center">
          <Typography variant="body-12" color="secondary">
            {formatTimeRemaining()}
          </Typography>
          
          <View className="flex-row space-x-2">
            {challenge.isCompleted && (
              <View className="bg-success px-3 py-1 rounded-full">
                <Typography variant="body-12" color="white">
                  Completed ✓
                </Typography>
              </View>
            )}
            
            {!challenge.isCompleted && !challenge.isJoined && onJoin && (
              <Button
                variant="primary"
                size="small"
                onPress={() => onJoin(challenge.id)}
              >
                Join
              </Button>
            )}
            
            {!challenge.isCompleted && challenge.isJoined && onLeave && (
              <Button
                variant="secondary"
                size="small"
                onPress={() => onLeave(challenge.id)}
              >
                Leave
              </Button>
            )}
          </View>
        </View>
      </Card>
    </Pressable>
  );
};