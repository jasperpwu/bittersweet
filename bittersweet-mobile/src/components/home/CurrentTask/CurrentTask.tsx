import React, { FC } from 'react';
import { View, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../ui/Card';
import { Typography } from '../../ui/Typography';

interface Task {
  id: string;
  title: string;
  category: string;
  duration: number; // in minutes
  isActive: boolean;
  progress?: number; // 0-1
}

interface CurrentTaskProps {
  task: Task | null;
  onPlayPress: () => void;
  onPausePress: () => void;
  onCreateTaskPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const getCategoryIcon = (category: string): keyof typeof Ionicons.glyphMap => {
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
  return iconMap[category] || 'time-outline';
};

const getCategoryColor = (category: string): string => {
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
  return colorMap[category] || '#6592E9';
};

export const CurrentTask: FC<CurrentTaskProps> = ({
  task,
  onPlayPress,
  onPausePress,
  onCreateTaskPress,
}) => {
  const playButtonScale = useSharedValue(1);

  const handlePlayPress = () => {
    playButtonScale.value = withSpring(0.9, {}, () => {
      playButtonScale.value = withSpring(1);
    });
    
    if (task?.isActive) {
      onPausePress();
    } else {
      onPlayPress();
    }
  };

  const playButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playButtonScale.value }],
  }));

  const handleCreateTaskPress = () => {
    if (onCreateTaskPress) {
      onCreateTaskPress();
    } else {
      // Default navigation to task creation modal
      router.push('/task-creation');
    }
  };

  if (!task) {
    return (
      <Card variant="default" className="mx-5 mb-6 bg-dark-bg border border-dark-border">
        <Pressable 
          onPress={handleCreateTaskPress}
          className="items-center py-8 active:opacity-80"
          accessibilityRole="button"
          accessibilityLabel="Create new task"
          accessibilityHint="Double tap to open task creation screen"
        >
          <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mb-4">
            <Ionicons name="add-outline" size={32} color="#6592E9" />
          </View>
          <Typography 
            variant="subtitle-16" 
            className="text-dark-text-primary mb-2"
          >
            No active task
          </Typography>
          <Typography 
            variant="body-14" 
            className="text-dark-text-secondary text-center"
          >
            Create a new task to start focusing
          </Typography>
        </Pressable>
      </Card>
    );
  }

  const categoryColor = getCategoryColor(task.category);
  const categoryIcon = getCategoryIcon(task.category);
  const progress = task.progress || 0;

  return (
    <Card variant="default" className="mx-5 mb-6 bg-dark-bg border border-dark-border">
      <View className="p-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Typography 
            variant="subtitle-14-medium" 
            className="text-dark-text-secondary"
          >
            Current task
          </Typography>
          <View className="flex-row items-center">
            <View 
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: task.isActive ? '#51BC6F' : '#CACACA' }}
            />
            <Typography 
              variant="body-12" 
              className="text-dark-text-secondary"
            >
              {task.isActive ? 'Active' : 'Paused'}
            </Typography>
          </View>
        </View>

        {/* Task Content */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            {/* Category Icon */}
            <View 
              className="w-12 h-12 rounded-xl items-center justify-center mr-4"
              style={{ backgroundColor: `${categoryColor}20` }}
            >
              <Ionicons 
                name={categoryIcon} 
                size={24} 
                color={categoryColor} 
              />
            </View>

            {/* Task Info */}
            <View className="flex-1">
              <Typography 
                variant="subtitle-16" 
                className="text-dark-text-primary mb-1"
                numberOfLines={1}
              >
                {task.title}
              </Typography>
              <Typography 
                variant="body-12" 
                className="text-dark-text-secondary"
              >
                {task.duration} min • {task.category}
              </Typography>
            </View>
          </View>

          {/* Play/Pause Button */}
          <AnimatedPressable
            style={[
              playButtonAnimatedStyle,
              {
                backgroundColor: task.isActive ? '#EF786C' : '#6592E9',
              }
            ]}
            onPress={handlePlayPress}
            className="w-12 h-12 rounded-full items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={task.isActive ? 'Pause task' : 'Start task'}
          >
            <Ionicons 
              name={task.isActive ? 'pause' : 'play'} 
              size={20} 
              color="#FFFFFF" 
            />
          </AnimatedPressable>
        </View>

        {/* Progress Bar */}
        {progress > 0 && (
          <View className="mt-4">
            <View className="h-2 bg-dark-border rounded-full overflow-hidden">
              <Animated.View 
                className="h-full bg-primary rounded-full"
                style={{ width: `${progress * 100}%` }}
              />
            </View>
            <Typography 
              variant="body-12" 
              className="text-dark-text-secondary mt-2 text-center"
            >
              {Math.round(progress * 100)}% complete
            </Typography>
          </View>
        )}
      </View>
    </Card>
  );
};