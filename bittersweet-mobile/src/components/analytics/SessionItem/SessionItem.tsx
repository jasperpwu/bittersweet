import { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Card } from '../../ui/Card';
import { Typography } from '../../ui/Typography';
import { FocusSession } from '../../../store/types';

export interface SessionItemProps {
  session: FocusSession;
  onPress?: () => void;
  variant?: 'compact' | 'detailed';
}

// Category display mapping with colors and icons
const categoryMap = {
  'Education': { name: 'Education', icon: '📚', color: '#51BC6F', gradient: 'from-green-400 to-green-500' },
  'Music': { name: 'Music', icon: '🎵', color: '#6592E9', gradient: 'from-blue-400 to-blue-500' },
  'Work': { name: 'Work', icon: '💼', color: '#8B5CF6', gradient: 'from-purple-400 to-purple-500' },
  'Meditation': { name: 'Meditation', icon: '🧘', color: '#FAC438', gradient: 'from-yellow-400 to-yellow-500' },
  'Code': { name: 'Code', icon: '💻', color: '#FD5B71', gradient: 'from-red-400 to-red-500' },
  'Study': { name: 'Study', icon: '📖', color: '#51BC6F', gradient: 'from-green-400 to-green-500' },
  'Reading': { name: 'Reading', icon: '📚', color: '#51BC6F', gradient: 'from-green-400 to-green-500' },
  'Exercise': { name: 'Exercise', icon: '💪', color: '#FD5B71', gradient: 'from-red-400 to-red-500' },
} as const;

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
};

const formatTimeRange = (startTime: Date, endTime?: Date): string => {
  const start = new Date(startTime);
  const startStr = start.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (!endTime) {
    return startStr;
  }
  
  const end = new Date(endTime);
  const endStr = end.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  return `${startStr} - ${endStr}`;
};

export const SessionItem: FC<SessionItemProps> = ({
  session,
  onPress,
  variant = 'detailed'
}) => {
  const categoryInfo = categoryMap[session.categoryId as keyof typeof categoryMap] || {
    name: session.categoryId,
    icon: '⏱️',
    color: '#6592E9',
    gradient: 'from-blue-400 to-blue-500'
  };

  const Component = onPress ? Pressable : View;

  return (
    <Component onPress={onPress} className={onPress ? 'active:opacity-80' : ''}>
      <Card variant="outlined" padding="medium" borderRadius="medium">
        <View className="flex-row items-center justify-between">
          {/* Left side - Category icon and session info */}
          <View className="flex-row items-center flex-1">
            {/* Category icon with colored background */}
            <View 
              className="w-10 h-10 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: `${categoryInfo.color}20` }}
            >
              <Typography variant="subtitle-16" className="text-lg">
                {categoryInfo.icon}
              </Typography>
            </View>
            
            {/* Session details */}
            <View className="flex-1">
              <Typography 
                variant="subtitle-16" 
                color="white"
                numberOfLines={1}
                className="mb-1"
              >
                {session.categoryId} Session
              </Typography>
              <Typography 
                variant="body-14" 
                color="secondary"
                numberOfLines={1}
              >
                {categoryInfo.name}
              </Typography>
            </View>
          </View>
          
          {/* Right side - Duration and time */}
          <View className="items-end">
            <Typography 
              variant="subtitle-16" 
              color="white"
              className="mb-1"
            >
              {formatDuration(session.duration)}
            </Typography>
            <Typography 
              variant="body-14" 
              color="secondary"
            >
              {formatTimeRange(session.startTime, session.endTime)}
            </Typography>
          </View>
        </View>
        
        {/* Tags (if any) */}
        {session.tagIds.length > 0 && variant === 'detailed' && (
          <View className="flex-row flex-wrap mt-3 pt-3 border-t border-dark-border">
            {session.tagIds.slice(0, 3).map((tagId: string, index: number) => (
              <View 
                key={index}
                className="bg-dark-border rounded-lg px-2 py-1 mr-2 mb-1"
              >
                <Typography variant="body-12" color="secondary">
                  {tagId}
                </Typography>
              </View>
            ))}
            {session.tagIds.length > 3 && (
              <View className="bg-dark-border rounded-lg px-2 py-1">
                <Typography variant="body-12" color="secondary">
                  +{session.tagIds.length - 3}
                </Typography>
              </View>
            )}
          </View>
        )}
        
        {/* Completion indicator */}
        {session.status === 'completed' && (
          <View className="absolute top-2 right-2" testID="completion-indicator">
            <View className="w-2 h-2 rounded-full bg-success" />
          </View>
        )}
      </Card>
    </Component>
  );
};