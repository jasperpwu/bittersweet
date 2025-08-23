import React, { FC } from 'react';
import { View } from 'react-native';
import { Typography } from '../ui/Typography';

interface DailyGoalsProgress {
  focusTime: {
    current: number;
    target: number;
  };
  sessions: {
    current: number;
    target: number;
  };
}

interface DailyGoalsProps {
  progress?: DailyGoalsProgress;
}

export const DailyGoals: FC<DailyGoalsProps> = ({ progress }) => {
  // Default progress values to prevent undefined errors
  const defaultProgress: DailyGoalsProgress = {
    focusTime: { current: 0, target: 240 },
    sessions: { current: 0, target: 5 }
  };

  const safeProgress = progress || defaultProgress;

  // Additional safety checks with proper fallbacks
  const focusTime = safeProgress.focusTime || defaultProgress.focusTime;
  const sessions = safeProgress.sessions || defaultProgress.sessions;

  // Ensure we have valid numbers to prevent division by zero
  const focusTarget = focusTime.target || 240;
  const sessionsTarget = sessions.target || 5;
  const focusCurrent = focusTime.current || 0;
  const sessionsCurrent = sessions.current || 0;

  const focusPercentage = Math.min((focusCurrent / focusTarget) * 100, 100);
  const sessionsPercentage = Math.min((sessionsCurrent / sessionsTarget) * 100, 100);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <View className="px-4 py-6">
      <Typography variant="subtitle-16" color="primary" className="mb-4">
        Today's Goals
      </Typography>
      
      <View className="bg-light-bg dark:bg-gray-800 rounded-2xl p-6">
        {/* Focus Time Goal */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-2">
            <Typography variant="body-14" color="primary">
              Focus Time
            </Typography>
            <Typography variant="body-12" color="secondary">
              {formatTime(focusCurrent)} / {formatTime(focusTarget)}
            </Typography>
          </View>
          
          <View className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <View 
              className="h-full bg-primary rounded-full"
              style={{ width: `${focusPercentage}%` }}
            />
          </View>
        </View>

        {/* Sessions Goal */}
        <View>
          <View className="flex-row justify-between items-center mb-2">
            <Typography variant="body-14" color="primary">
              Sessions
            </Typography>
            <Typography variant="body-12" color="secondary">
              {sessionsCurrent} / {sessionsTarget}
            </Typography>
          </View>
          
          <View className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <View 
              className="h-full bg-success rounded-full"
              style={{ width: `${sessionsPercentage}%` }}
            />
          </View>
        </View>
      </View>
    </View>
  );
};