import React, { FC } from 'react';
import { View } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';

interface SessionStatusProps {
  currentSession: number;
  totalSessions: number;
  sessionType: 'focus' | 'break' | 'longBreak';
  completedSessions: number;
}


export const SessionStatus: FC<SessionStatusProps> = ({
  currentSession,
  totalSessions,
  sessionType,
  completedSessions,
}) => {
  const getSessionTypeLabel = () => {
    switch (sessionType) {
      case 'focus':
        return 'Focus Session';
      case 'break':
        return 'Short Break';
      case 'longBreak':
        return 'Long Break';
      default:
        return 'Session';
    }
  };

  return (
    <Card variant="default" padding="medium" className="mx-4 mb-4">
      <View className="items-center">
        <Typography variant="subtitle-16" color="primary" className="mb-2">
          {getSessionTypeLabel()}
        </Typography>
        <Typography variant="body-14" color="secondary">
          Session {currentSession} of {totalSessions}
        </Typography>
        <View className="flex-row mt-2 space-x-2">
          {Array.from({ length: totalSessions }, (_, index) => (
            <View
              key={index}
              className={`
                w-2 h-2 rounded-full
                ${index < completedSessions 
                  ? 'bg-success' 
                  : index === currentSession - 1 
                    ? 'bg-primary' 
                    : 'bg-light-border dark:bg-dark-border'
                }
              `}
            />
          ))}
        </View>
      </View>
    </Card>
  );
};