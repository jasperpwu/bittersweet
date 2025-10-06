import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../ui/Card';
import { Typography } from '../../ui/Typography';
import { FocusSession } from '../../../types/models';

interface CurrentTaskProps {
  session: FocusSession | null;
  onPlayPress: () => void;
  onPausePress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getTagIcon = (tag: string): keyof typeof Ionicons.glyphMap => {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    'Work': 'briefcase-outline',
    'Study': 'book-outline',
    'Reading': 'library-outline',
    'Exercise': 'fitness-outline',
    'Meditation': 'leaf-outline',
    'Code': 'code-slash-outline',
    'IT': 'laptop-outline',
    'Sport': 'basketball-outline',
    'Music': 'musical-notes-outline',
  };
  return iconMap[tag] || 'time-outline';
};

const getTagColor = (tag: string): string => {
  const colorMap: Record<string, string> = {
    'Work': '#6592E9',
    'Study': '#51BC6F',
    'Reading': '#51BC6F', // Green like in Figma
    'Exercise': '#FFA556', // Orange like in Figma
    'Meditation': '#FAC438', // Yellow like in Figma
    'Code': '#FD5B71', // Red like in Figma
    'IT': '#2196F3',
    'Sport': '#FFA556', // Orange like in Figma
    'Music': '#E91E63',
  };
  return colorMap[tag] || '#6592E9';
};

export const CurrentTask: FC<CurrentTaskProps> = ({
  session,
  onPlayPress,
  onPausePress,
}) => {
  const playButtonScale = useSharedValue(1);

  const handlePlayPress = () => {
    playButtonScale.value = withSpring(0.9, {}, () => {
      playButtonScale.value = withSpring(1);
    });
    
    if (session?.status === 'active') {
      onPausePress();
    } else {
      onPlayPress();
    }
  };

  const playButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playButtonScale.value }],
  }));



  if (!session) {
    return (
      <Card variant="default" className="mx-5 mb-6 bg-dark-bg border border-dark-border">
        <View className="p-4">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-4">
            <Typography 
              variant="subtitle-14-medium" 
              className="text-dark-text-secondary"
            >
              Current session
            </Typography>
          </View>

          {/* Empty State */}
          <View className="items-center py-8">
            <Typography 
              variant="subtitle-16" 
              className="text-dark-text-primary mb-2"
            >
              No active session
            </Typography>
            <Typography 
              variant="body-14" 
              className="text-dark-text-secondary text-center"
            >
              Create a focus session to start
            </Typography>
          </View>
        </View>
      </Card>
    );
  }

  const primaryTag = session.tags[0] || '';
  const tagColor = getTagColor(primaryTag);
  const tagIcon = getTagIcon(primaryTag);

  return (
    <Card variant="default" className="mx-5 mb-6 bg-dark-bg border border-dark-border">
      <View className="p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Typography 
            variant="subtitle-14-medium" 
            className="text-dark-text-secondary"
          >
            Current session
          </Typography>
          <View className="flex-row items-center">
            <View 
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: session.status === 'active' ? '#51BC6F' : '#CACACA' }}
            />
            <Typography 
              variant="body-12" 
              className="text-dark-text-secondary"
            >
              {session.status === 'active' ? 'Active' : session.status === 'paused' ? 'Paused' : 'Scheduled'}
            </Typography>
          </View>
        </View>

        {/* Session Content */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            {/* Tag Icon */}
            <View 
              className="w-12 h-12 rounded-xl items-center justify-center mr-4"
              style={{ backgroundColor: `${tagColor}20` }}
            >
              <Ionicons 
                name={tagIcon} 
                size={24} 
                color={tagColor} 
              />
            </View>

            {/* Session Info */}
            <View className="flex-1">
              <Typography 
                variant="subtitle-16" 
                className="text-dark-text-primary mb-1"
                numberOfLines={1}
              >
                {session.notes || 'Focus Session'}
              </Typography>
              <Typography 
                variant="body-12" 
                className="text-dark-text-secondary"
              >
                {session.targetDuration} min • {session.tags[0] || 'No tag'}
              </Typography>
            </View>
          </View>

          {/* Play/Pause Button */}
          <AnimatedPressable
            style={[
              playButtonAnimatedStyle,
              {
                backgroundColor: session.status === 'active' ? '#EF786C' : '#6592E9',
              }
            ]}
            onPress={handlePlayPress}
            className="w-12 h-12 rounded-full items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={session.status === 'active' ? 'Pause session' : 'Start session'}
          >
            <Ionicons 
              name={session.status === 'active' ? 'pause' : 'play'} 
              size={20} 
              color="#FFFFFF" 
            />
          </AnimatedPressable>
        </View>

        {/* Session status */}
        {session.status && (
          <View className="mt-4">
            <Typography 
              variant="body-12" 
              className="text-dark-text-secondary text-center"
            >
              Status: {session.status}
            </Typography>
          </View>
        )}
      </View>
    </Card>
  );
};