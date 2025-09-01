import { FC } from 'react';
import { View, Pressable } from 'react-native';
import { Card } from '../../ui/Card';
import { Typography } from '../../ui/Typography';
import { FocusSession } from '../../../store/types';
import { useFocus } from '../../../store';

export interface SessionItemProps {
  session: FocusSession;
  onPress?: () => void;
  variant?: 'compact' | 'detailed';
}

// Tag color mapping - fallback colors for tags
const tagColorMap = {
  'Work': '#8B5CF6',
  'Study': '#51BC6F', 
  'Personal': '#6592E9',
  'Exercise': '#FD5B71',
  'Creative': '#FAC438',
  'Reading': '#51BC6F',
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
  const { tags } = useFocus();
  
  // Get primary tag info (use tagId or default)
  const primaryTag = session.tagId ? tags.byId[session.tagId] : null;
  const tagInfo = {
    name: primaryTag?.name || 'Focus Session',
    icon: primaryTag?.icon || '⏱️',
    color: primaryTag?.name ? tagColorMap[primaryTag.name as keyof typeof tagColorMap] || '#6592E9' : '#6592E9'
  };

  const Component = onPress ? Pressable : View;

  return (
    <Component onPress={onPress} className={onPress ? 'active:opacity-80' : ''}>
      <Card variant="outlined" padding="medium" borderRadius="medium">
        <View className="flex-row items-center justify-between">
          {/* Left side - Tag icon and session info */}
          <View className="flex-row items-center flex-1">
            {/* Tag icon with colored background */}
            <View 
              className="w-10 h-10 rounded-xl items-center justify-center mr-3"
              style={{ backgroundColor: `${tagInfo.color}20` }}
            >
              <Typography variant="subtitle-16" className="text-lg">
                {tagInfo.icon}
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
                {tagInfo.name} Session
              </Typography>
              <Typography 
                variant="body-14" 
                color="secondary"
                numberOfLines={1}
              >
                {session.notes || `${formatDuration(session.duration)} session`}
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
        
        {/* Tag (if any) */}
        {session.tagId && variant === 'detailed' && (
          <View className="flex-row flex-wrap mt-3 pt-3 border-t border-dark-border">
            <View className="bg-dark-border rounded-lg px-2 py-1 mr-2 mb-1">
              <Typography variant="body-12" color="secondary">
                {primaryTag?.name || session.tagId}
              </Typography>
            </View>
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