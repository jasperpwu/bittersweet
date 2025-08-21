import { FC } from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { Typography } from '../../ui/Typography/Typography';
import { Task } from '../../../types/models';

interface TaskBlockProps {
  task: Task;
  onPress: () => void;
  style?: ViewStyle;
  timeSlotHeight: number;
  pixelsPerMinute: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Category colors mapping
const categoryColors = {
  Reading: '#51BC6F',
  Sport: '#FF9800',
  Music: '#9C27B0',
  Meditation: '#4CAF50',
  Code: '#EF786C',
  IT: '#6592E9',
  Work: '#6592E9',
  Study: '#FFC107',
  Exercise: '#FF9800',
  Personal: '#9E9E9E',
} as const;

const getStatusColor = (status: Task['status']) => {
  switch (status) {
    case 'completed':
      return '#51BC6F';
    case 'active':
      return '#6592E9';
    case 'cancelled':
      return '#EF786C';
    default:
      return '#CACACA';
  }
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatTimeRange = (startTime: Date, duration: number) => {
  const endTime = new Date(startTime.getTime() + duration * 60000);
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
};

export const TaskBlock: FC<TaskBlockProps> = ({
  task,
  onPress,
  style,
  pixelsPerMinute,
}) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(scale.value, { damping: 15, stiffness: 300 }) }],
  }));

  const handlePressIn = () => {
    scale.value = 0.98;
  };

  const handlePressOut = () => {
    scale.value = 1;
  };

  // Calculate block height based on duration
  const blockHeight = Math.max(task.duration * pixelsPerMinute, 50);
  
  // Get category color
  const categoryColor = categoryColors[task.category.name as keyof typeof categoryColors] || '#6592E9';
  
  // Get status color for the indicator
  const statusColor = getStatusColor(task.status);

  return (
    <AnimatedPressable
      style={[
        {
          height: blockHeight,
          backgroundColor: categoryColor,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        },
        animatedStyle,
        style,
      ]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        {/* Task title and time */}
        <View style={{ flex: 1, justifyContent: 'flex-start' }}>
          <Typography
            variant="subtitle-14-semibold"
            className="text-white"
            numberOfLines={blockHeight > 70 ? 2 : 1}
            style={{ marginBottom: blockHeight > 60 ? 4 : 2 }}
          >
            {task.title}
          </Typography>
          {blockHeight > 60 && (
            <Typography
              variant="body-12"
              className="text-white"
              style={{ opacity: 0.9 }}
            >
              {formatTimeRange(task.startTime, task.duration)}
            </Typography>
          )}
        </View>

        {/* Status indicator and progress */}
        {blockHeight > 50 && (
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginTop: blockHeight > 70 ? 8 : 4,
          }}>
            {/* Circular status indicator */}
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: statusColor,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.3)',
              }}
            />
            
            {/* Progress indicator */}
            {task.progress.totalSessions > 0 && (
              <Typography
                variant="tiny-10"
                className="text-white"
                style={{ opacity: 0.9 }}
              >
                {task.progress.completedSessions}/{task.progress.totalSessions}
              </Typography>
            )}
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
};