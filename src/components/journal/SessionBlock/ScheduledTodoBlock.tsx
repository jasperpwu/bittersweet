import { FC } from 'react';
import { View, Pressable, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../ui/Typography';
import { useFocus } from '../../../store';
import { colors } from '../../../config/theme';
import type { Todo } from '../../../store/types';
import type { TodoScheduleController } from '../TodoSheet/TodoScheduleController';
import {
  PIXELS_PER_MINUTE,
  SNAP_MINUTES,
  DEFAULT_TODO_DURATION,
  END_HOUR,
} from '../Timeline/constants';

interface ScheduledTodoBlockProps {
  todo: Todo;
  schedule?: TodoScheduleController;
  style?: ViewStyle;
  onPress: () => void;
  onReschedule: (minutes: number) => void;
}

const DAY_END_MINUTES = (END_HOUR + 1) * 60;

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

/**
 * A planned (not-yet-completed) TODO rendered on the calendar. Visually distinct
 * from a real focus session: dotted border + translucent fill. Tap opens the
 * edit modal; long-press lifts it for drag-to-reschedule (snapped to 15 min).
 */
export const ScheduledTodoBlock: FC<ScheduledTodoBlockProps> = ({
  todo,
  schedule,
  style,
  onPress,
  onReschedule,
}) => {
  const { tags } = useFocus();
  const tag = tags.byId[todo.tagId];
  const color = tag?.color ?? colors.primary;
  const name = todo.name || tag?.name || 'Task';
  const duration = todo.durationMinutes ?? DEFAULT_TODO_DURATION;
  const blockHeight = Math.max(duration * PIXELS_PER_MINUTE, 22);

  const start = todo.startAt ? new Date(todo.startAt) : new Date();
  const startMinutes = start.getHours() * 60 + start.getMinutes();

  const translateY = useSharedValue(0);
  const lifted = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: withSpring(lifted.value ? 1.03 : 1, { damping: 18, stiffness: 320 }) },
    ],
    opacity: withSpring(lifted.value ? 0.95 : 1),
    zIndex: lifted.value ? 50 : 1,
  }));

  // Snap the dragged offset to the target start minute (clamped to the day).
  const targetMinutes = (offsetPx: number) => {
    'worklet';
    const raw = startMinutes + offsetPx / PIXELS_PER_MINUTE;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.max(0, Math.min(DAY_END_MINUTES - duration, snapped));
  };

  const dragGesture = Gesture.Pan()
    .activateAfterLongPress(220)
    .onStart(() => {
      lifted.value = 1;
      if (schedule) {
        schedule.previewDuration.value = duration;
        schedule.previewMinutes.value = startMinutes;
        schedule.previewActive.value = 1;
      }
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      if (schedule) schedule.previewMinutes.value = targetMinutes(e.translationY);
    })
    .onEnd(() => {
      const clamped = targetMinutes(translateY.value);
      translateY.value = 0;
      lifted.value = 0;
      if (schedule) schedule.previewActive.value = 0;
      if (clamped !== startMinutes) {
        runOnJS(onReschedule)(clamped);
      }
    })
    .onFinalize((_e, success) => {
      // Make sure the preview never sticks if the gesture is cancelled.
      if (schedule && !success) schedule.previewActive.value = 0;
    });

  const compact = blockHeight <= 34;

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View style={[{ position: 'absolute' }, style, animatedStyle]}>
        <Pressable
          onPress={onPress}
          style={{
            height: blockHeight,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: color,
            borderStyle: 'dotted',
            backgroundColor: `${color}1F`, // ~12% — more transparent than a session
            paddingHorizontal: 10,
            paddingVertical: compact ? 3 : 6,
            justifyContent: compact ? 'center' : 'flex-start',
          }}
        >
          <View className="flex-row items-center">
            <Ionicons
              name="time-outline"
              size={compact ? 11 : 13}
              color={color}
              style={{ marginRight: 4 }}
            />
            <Typography
              variant={compact ? 'tiny-10' : 'body-12'}
              color="primary"
              numberOfLines={1}
              style={{ flex: 1, color }}
            >
              {name}
            </Typography>
          </View>
          {!compact && (
            <Typography variant="tiny-10" color="secondary" style={{ marginTop: 2, opacity: 0.9 }}>
              {formatTime(start)} · {duration}m
            </Typography>
          )}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
};
