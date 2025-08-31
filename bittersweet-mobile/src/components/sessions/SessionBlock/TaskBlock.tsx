import { FC } from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { Typography } from '../../ui/Typography/Typography';
import { FocusSession } from '../../../types/models';
import { useFocus } from '../../../store';

interface TaskBlockProps {
  session: FocusSession;
  onPress: () => void;
  style?: ViewStyle;
  timeSlotHeight: number;
  pixelsPerMinute: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Tag-based colors mapping - fallback colors for tags
const tagColors = {
  Work: '#6592E9',
  Study: '#FFC107',
  Personal: '#9E9E9E',
  Exercise: '#FF9800',
  Creative: '#9C27B0',
  Reading: '#51BC6F',
} as const;

const getStatusColor = (status: FocusSession['status']) => {
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
  session,
  onPress,
  style,
  pixelsPerMinute,
}) => {
  const { tags } = useFocus();
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
  const blockHeight = Math.max(session.duration * pixelsPerMinute, 50);
  
  // Get primary tag color (use first tag or default)
  const primaryTag = session.tags[0];
  const tag = primaryTag ? tags.byId[primaryTag] : null;
  const tagColor = tag?.name ? tagColors[tag.name as keyof typeof tagColors] || '#6592E9' : '#6592E9';
  
  // Get status color for the indicator
  const statusColor = getStatusColor(session.status);

  return (
    <AnimatedPressable
      style={[
        {
          height: blockHeight,
          backgroundColor: tagColor,
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
        {/* Session info and time */}
        <View style={{ flex: 1, justifyContent: 'flex-start' }}>
          <Typography
            variant="subtitle-14-semibold"
            className="text-white"
            numberOfLines={blockHeight > 70 ? 2 : 1}
            style={{ marginBottom: blockHeight > 60 ? 4 : 2 }}
          >
            {session.notes || 'Focus Session'}
          </Typography>
          {blockHeight > 60 && (
            <Typography
              variant="body-12"
              className="text-white"
              style={{ opacity: 0.9 }}
            >
              {formatTimeRange(session.startTime, session.duration)}
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
            
            {/* Duration indicator */}
            {session.duration > 0 && (
              <Typography
                variant="tiny-10"
                className="text-white"
                style={{ opacity: 0.9 }}
              >
                {session.duration}min
              </Typography>
            )}
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
};