import { FC } from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { Typography } from '../../ui/Typography';

interface FocusSession {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  tags: string[];
  notes?: string;
}

interface SessionBlockProps {
  session: FocusSession;
  onPress: () => void;
  style?: ViewStyle;
  timeSlotHeight: number;
  pixelsPerMinute: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Tag colors mapping
const tagColors = {
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
  Focus: '#6592E9',
} as const;

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatTimeRange = (startTime: Date, endTime: Date) => {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
};

export const SessionBlock: FC<SessionBlockProps> = ({
  session,
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
  const blockHeight = Math.max(session.duration * pixelsPerMinute, 50);
  
  // Get tag color (use first tag or default)
  const primaryTag = session.tags[0] || 'Focus';
  const sessionColor = tagColors[primaryTag as keyof typeof tagColors] || '#6592E9';

  return (
    <AnimatedPressable
      style={[
        {
          height: blockHeight,
          backgroundColor: sessionColor,
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
        {/* Session info */}
        <View style={{ flex: 1, justifyContent: 'flex-start' }}>
          <Typography
            variant="subtitle-14-semibold"
            color="white"
            numberOfLines={blockHeight > 70 ? 2 : 1}
            style={{ marginBottom: blockHeight > 60 ? 4 : 2 }}
          >
            {session.tags.join(', ') || 'Focus Session'}
          </Typography>
          {blockHeight > 60 && (
            <Typography
              variant="body-12"
              color="white"
              style={{ opacity: 0.9 }}
            >
              {formatTimeRange(session.startTime, session.endTime)}
            </Typography>
          )}
          {blockHeight > 80 && session.notes && (
            <Typography
              variant="tiny-10"
              color="white"
              style={{ opacity: 0.8, marginTop: 2 }}
              numberOfLines={2}
            >
              {session.notes}
            </Typography>
          )}
        </View>

        {/* Duration indicator */}
        {blockHeight > 50 && (
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginTop: blockHeight > 70 ? 8 : 4,
          }}>
            {/* Focus indicator dot */}
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: 'white',
                opacity: 0.8,
              }}
            />
            
            {/* Duration */}
            <Typography
              variant="tiny-10"
              color="white"
              style={{ opacity: 0.9 }}
            >
              {session.duration}min
            </Typography>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
};