import React, { FC } from 'react';
import { View, Pressable, Share } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';

interface ProgressData {
  focusMinutesToday: number;
  focusMinutesWeek: number;
  sessionsCompleted: number;
  currentStreak: number;
  seedsEarned: number;
  rank?: number;
  totalParticipants?: number;
}

interface ProgressShareProps {
  progress: ProgressData;
  userName: string;
  onShare?: (shareData: ShareData) => void;
  onCustomShare?: () => void;
  showRank?: boolean;
}

interface ShareData {
  message: string;
  url?: string;
  title?: string;
}


export const ProgressShare: FC<ProgressShareProps> = ({
  progress,
  userName,
  onShare,
  onCustomShare,
  showRank = true,
}) => {
  const generateShareMessage = () => {
    const achievements = [];
    
    if (progress.focusMinutesToday > 0) {
      achievements.push(`${progress.focusMinutesToday} minutes of focused work today`);
    }
    
    if (progress.currentStreak > 1) {
      achievements.push(`${progress.currentStreak}-day focus streak`);
    }
    
    if (progress.sessionsCompleted > 0) {
      achievements.push(`${progress.sessionsCompleted} focus sessions completed`);
    }

    const baseMessage = `🎯 ${userName}'s Focus Progress:\n\n${achievements.join('\n')}\n\n`;
    const encouragement = `Building better focus habits with bittersweet! 🌱`;
    
    return baseMessage + encouragement;
  };

  const handleNativeShare = async () => {
    try {
      const shareData: ShareData = {
        message: generateShareMessage(),
        title: `${userName}'s Focus Progress`,
      };

      await Share.share({
        message: shareData.message,
        title: shareData.title,
      });

      onShare?.(shareData);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Card variant="default" padding="medium" className="mx-4 mb-4">
      <View className="items-center">
        <Typography variant="subtitle-16" color="primary" className="mb-4 text-center">
          Share Your Progress
        </Typography>

        {/* Progress Summary */}
        <View className="w-full bg-light-bg dark:bg-dark-bg rounded-xl p-4 mb-4">
          <View className="flex-row justify-between items-center mb-2">
            <Typography variant="body-12" color="secondary">
              Today's Focus:
            </Typography>
            <Typography variant="subtitle-14-semibold" color="primary">
              {formatTime(progress.focusMinutesToday)}
            </Typography>
          </View>

          <View className="flex-row justify-between items-center mb-2">
            <Typography variant="body-12" color="secondary">
              This Week:
            </Typography>
            <Typography variant="subtitle-14-semibold" color="primary">
              {formatTime(progress.focusMinutesWeek)}
            </Typography>
          </View>

          <View className="flex-row justify-between items-center mb-2">
            <Typography variant="body-12" color="secondary">
              Sessions:
            </Typography>
            <Typography variant="subtitle-14-semibold" color="primary">
              {progress.sessionsCompleted}
            </Typography>
          </View>

          <View className="flex-row justify-between items-center mb-2">
            <Typography variant="body-12" color="secondary">
              Streak:
            </Typography>
            <Typography variant="subtitle-14-semibold" color="success">
              {progress.currentStreak} days
            </Typography>
          </View>

          {showRank && progress.rank && progress.totalParticipants && (
            <View className="flex-row justify-between items-center">
              <Typography variant="body-12" color="secondary">
                Rank:
              </Typography>
              <Typography variant="subtitle-14-semibold" color="primary">
                #{progress.rank} of {progress.totalParticipants}
              </Typography>
            </View>
          )}
        </View>

        {/* Share Buttons */}
        <View className="flex-row space-x-3 w-full">
          <Button
            variant="primary"
            size="medium"
            onPress={handleNativeShare}
            className="flex-1"
          >
            Share Progress
          </Button>
          
          {onCustomShare && (
            <Button
              variant="secondary"
              size="medium"
              onPress={onCustomShare}
              className="flex-1"
            >
              Custom Share
            </Button>
          )}
        </View>

        <Typography variant="tiny-10" color="secondary" className="mt-3 text-center">
          Share your achievements and inspire others!
        </Typography>
      </View>
    </Card>
  );
};