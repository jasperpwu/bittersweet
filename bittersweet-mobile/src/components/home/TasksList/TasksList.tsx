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

interface Task {
  id: string;
  title: string;
  category: string;
  duration: number; // in minutes
  startTime: string; // e.g., "09:00"
  isCompleted: boolean;
  isActive: boolean;
}

interface TasksListProps {
  tasks: Task[];
  onTaskPress: (taskId: string) => void;
  onViewAllPress: () => void;
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

interface TaskItemProps {
  task: Task;
  onPress: () => void;
}

const TaskItem: FC<TaskItemProps> = ({ task, onPress }) => {
  const scale = useSharedValue(1);
  const playButtonScale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.98, {}, () => {
      scale.value = withSpring(1);
    });
    onPress();
  };

  const handlePlayPress = () => {
    playButtonScale.value = withSpring(0.9, {}, () => {
      playButtonScale.value = withSpring(1);
    });
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const playButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playButtonScale.value }],
  }));

  const categoryColor = getCategoryColor(task.category);
  const categoryIcon = getCategoryIcon(task.category);

  return (
    <AnimatedPressable
      style={animatedStyle}
      onPress={handlePress}
      className="mb-3"
      accessibilityRole="button"
      accessibilityLabel={`${task.title} task`}
    >
      <View className="flex-row items-center p-4 bg-dark-bg border border-dark-border rounded-xl">
        {/* Category Icon */}
        <View 
          className="w-10 h-10 rounded-lg items-center justify-center mr-3"
          style={{ backgroundColor: `${categoryColor}20` }}
        >
          <Ionicons 
            name={categoryIcon} 
            size={20} 
            color={categoryColor} 
          />
        </View>

        {/* Task Info */}
        <View className="flex-1">
          <Typography 
            variant="subtitle-14-semibold" 
            className="text-dark-text-primary mb-1"
            numberOfLines={1}
          >
            {task.title}
          </Typography>
          <View className="flex-row items-center">
            <Typography 
              variant="body-12" 
              className="text-dark-text-secondary mr-3"
            >
              {task.startTime}
            </Typography>
            <Typography 
              variant="body-12" 
              className="text-dark-text-secondary"
            >
              {task.duration} min
            </Typography>
          </View>
        </View>

        {/* Status & Play Button */}
        <View className="flex-row items-center">
          {/* Status Indicator */}
          {task.isCompleted ? (
            <View className="w-6 h-6 rounded-full bg-success items-center justify-center mr-3">
              <Ionicons name="checkmark" size={16} color="#FFFFFF" />
            </View>
          ) : task.isActive ? (
            <View className="w-6 h-6 rounded-full bg-primary items-center justify-center mr-3">
              <View className="w-2 h-2 rounded-full bg-white" />
            </View>
          ) : (
            <View className="w-6 h-6 rounded-full border-2 border-dark-border mr-3" />
          )}

          {/* Play Button */}
          {!task.isCompleted && (
            <AnimatedPressable
              style={playButtonAnimatedStyle}
              onPress={handlePlayPress}
              className="w-8 h-8 rounded-full bg-primary items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel={task.isActive ? 'Pause task' : 'Start task'}
            >
              <Ionicons 
                name={task.isActive ? 'pause' : 'play'} 
                size={14} 
                color="#FFFFFF" 
              />
            </AnimatedPressable>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
};

export const TasksList: FC<TasksListProps> = ({
  tasks,
  onTaskPress,
  onViewAllPress,
}) => {
  const viewAllScale = useSharedValue(1);

  const handleViewAllPress = () => {
    viewAllScale.value = withSpring(0.98, {}, () => {
      viewAllScale.value = withSpring(1);
    });
    onViewAllPress();
  };

  const viewAllAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: viewAllScale.value }],
  }));

  if (tasks.length === 0) {
    return (
      <Card variant="default" className="mx-5 mb-6 bg-dark-bg border border-dark-border">
        <View className="items-center py-8">
          <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center mb-4">
            <Ionicons name="calendar-outline" size={32} color="#6592E9" />
          </View>
          <Typography 
            variant="subtitle-16" 
            className="text-dark-text-primary mb-2"
          >
            No tasks for today
          </Typography>
          <Typography 
            variant="body-14" 
            className="text-dark-text-secondary text-center"
          >
            Create your first task to get started
          </Typography>
        </View>
      </Card>
    );
  }

  // Show only first 3 tasks
  const displayTasks = tasks.slice(0, 3);
  const hasMoreTasks = tasks.length > 3;

  return (
    <View className="mx-5 mb-6">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Typography 
          variant="subtitle-16" 
          className="text-dark-text-primary"
        >
          Today's tasks
        </Typography>
        
        {hasMoreTasks && (
          <AnimatedPressable
            style={viewAllAnimatedStyle}
            onPress={handleViewAllPress}
            className="px-3 py-1"
            accessibilityRole="button"
            accessibilityLabel="View all tasks"
          >
            <Typography 
              variant="body-14" 
              className="text-primary"
            >
              View all ({tasks.length})
            </Typography>
          </AnimatedPressable>
        )}
      </View>

      {/* Tasks List */}
      <View>
        {displayTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            onPress={() => onTaskPress(task.id)}
          />
        ))}
      </View>

      {/* View All Button (if no header button) */}
      {!hasMoreTasks && tasks.length > 0 && (
        <AnimatedPressable
          style={viewAllAnimatedStyle}
          onPress={handleViewAllPress}
          className="mt-2 p-3 bg-dark-bg border border-dark-border rounded-xl items-center"
          accessibilityRole="button"
          accessibilityLabel="View all tasks"
        >
          <Typography 
            variant="body-14" 
            className="text-primary"
          >
            View all tasks
          </Typography>
        </AnimatedPressable>
      )}
    </View>
  );
};