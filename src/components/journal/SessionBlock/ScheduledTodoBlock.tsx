import { FC } from 'react';
import { View, Pressable, ViewStyle, StyleSheet, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
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
  /** Commit a move/resize: new start minute-of-day + new duration (minutes). */
  onReschedule: (minutes: number, durationMinutes: number) => void;
  /** Editing state is owned by the timeline so only one block is armed at a time. */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** Day column this block sits in (3-day view); anchors the reposition preview. */
  dayIndex?: number;
  /** Tighter paddings/typography for the narrow 3-day columns. */
  dense?: boolean;
}

const DAY_END_MINUTES = (END_HOUR + 1) * 60;
const MIN_DURATION = SNAP_MINUTES;
const HANDLE_SIZE = 12;
// Invisible grab strip spanning the full block width, centered on each edge.
const EDGE_GRIP_HEIGHT = 16;
// Extra touch area beyond the strip (kept small so the two grips on a short
// block don't fight over the middle).
const HANDLE_HIT_SLOP = { top: 4, bottom: 4 };

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

/**
 * A planned (not-yet-completed) TODO rendered on the calendar. Visually distinct
 * from a real focus session: dotted border + translucent fill. Tap opens the
 * edit modal; long-press arms the block for editing — solid border + resize
 * handles. While armed: drag the body to move it (15-min snap), drag the top
 * handle to change the start time (end fixed), or the bottom handle to change
 * the end time. Tap the armed block to exit editing.
 */
export const ScheduledTodoBlock: FC<ScheduledTodoBlockProps> = ({
  todo,
  schedule,
  style,
  onPress,
  onReschedule,
  selected = false,
  onSelectedChange,
  dayIndex = 0,
  dense = false,
}) => {
  const { tags } = useFocus();
  const colorScheme = useColorScheme();
  const tag = tags.byId[todo.tagId];
  const color = tag?.color ?? colors.primary;
  const name = todo.name || tag?.name || 'Task';
  const duration = todo.durationMinutes ?? DEFAULT_TODO_DURATION;
  const blockHeight = Math.max(duration * PIXELS_PER_MINUTE, 22);

  const start = todo.startAt ? new Date(todo.startAt) : new Date();
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = startMinutes + duration;

  // Live drag offsets of the block's top and bottom edges (px). A body move
  // shifts both together; a handle drag shifts only its own edge.
  const dTop = useSharedValue(0);
  const dBottom = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dTop.value }],
    height: Math.max(blockHeight + dBottom.value - dTop.value, MIN_DURATION * PIXELS_PER_MINUTE),
  }));

  // --- Snapped drop targets (worklets) ---

  // Body move: keep duration, clamp the whole block inside the day.
  const moveTarget = (offsetPx: number) => {
    'worklet';
    const raw = startMinutes + offsetPx / PIXELS_PER_MINUTE;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.max(0, Math.min(DAY_END_MINUTES - duration, snapped));
  };

  // Top edge: new start time; the end stays fixed.
  const topTarget = (offsetPx: number) => {
    'worklet';
    const raw = startMinutes + offsetPx / PIXELS_PER_MINUTE;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.max(0, Math.min(endMinutes - MIN_DURATION, snapped));
  };

  // Bottom edge: new end time; the start stays fixed.
  const bottomTarget = (offsetPx: number) => {
    'worklet';
    const raw = endMinutes + offsetPx / PIXELS_PER_MINUTE;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    return Math.max(startMinutes + MIN_DURATION, Math.min(DAY_END_MINUTES, snapped));
  };

  const beginPreview = () => {
    'worklet';
    if (!schedule) return;
    schedule.previewDuration.value = duration;
    schedule.previewMinutes.value = startMinutes;
    schedule.previewDayIndex.value = dayIndex;
    schedule.previewActive.value = 1;
  };

  const resetDrag = () => {
    'worklet';
    dTop.value = 0;
    dBottom.value = 0;
    if (schedule) schedule.previewActive.value = 0;
  };

  // --- Gestures (active only while the block is armed) ---

  const movePan = Gesture.Pan()
    .enabled(selected)
    .activeOffsetY([-4, 4])
    .onStart(() => {
      beginPreview();
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      dTop.value = e.translationY;
      dBottom.value = e.translationY;
      if (schedule) schedule.previewMinutes.value = moveTarget(e.translationY);
    })
    .onEnd(() => {
      const newStart = moveTarget(dTop.value);
      resetDrag();
      if (newStart !== startMinutes) runOnJS(onReschedule)(newStart, duration);
    })
    .onFinalize((_e, success) => {
      if (!success) resetDrag();
    });

  const topPan = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      beginPreview();
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      // Visual clamp: top edge stays within the day and above the bottom edge.
      const maxUp = -startMinutes * PIXELS_PER_MINUTE;
      const maxDown = (duration - MIN_DURATION) * PIXELS_PER_MINUTE;
      dTop.value = Math.max(maxUp, Math.min(maxDown, e.translationY));
      if (schedule) {
        const newStart = topTarget(dTop.value);
        schedule.previewMinutes.value = newStart;
        schedule.previewDuration.value = endMinutes - newStart;
      }
    })
    .onEnd(() => {
      const newStart = topTarget(dTop.value);
      resetDrag();
      if (newStart !== startMinutes) runOnJS(onReschedule)(newStart, endMinutes - newStart);
    })
    .onFinalize((_e, success) => {
      if (!success) resetDrag();
    });

  const bottomPan = Gesture.Pan()
    .hitSlop(HANDLE_HIT_SLOP)
    .onStart(() => {
      beginPreview();
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      // Visual clamp: bottom edge stays below the top edge and within the day.
      const maxUp = (MIN_DURATION - duration) * PIXELS_PER_MINUTE;
      const maxDown = (DAY_END_MINUTES - endMinutes) * PIXELS_PER_MINUTE;
      dBottom.value = Math.max(maxUp, Math.min(maxDown, e.translationY));
      if (schedule) {
        const newEnd = bottomTarget(dBottom.value);
        schedule.previewMinutes.value = startMinutes;
        schedule.previewDuration.value = newEnd - startMinutes;
      }
    })
    .onEnd(() => {
      const newEnd = bottomTarget(dBottom.value);
      resetDrag();
      if (newEnd !== endMinutes) runOnJS(onReschedule)(startMinutes, newEnd - startMinutes);
    })
    .onFinalize((_e, success) => {
      if (!success) resetDrag();
    });

  const handlePress = () => {
    if (selected) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelectedChange?.(false);
    } else {
      onPress();
    }
  };

  const handleLongPress = () => {
    if (!selected) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSelectedChange?.(true);
    }
  };

  const compact = blockHeight <= 34;
  const handleFill = colorScheme === 'dark' ? colors.dark.screen : colors.light.screen;

  return (
    <Animated.View
      style={[{ position: 'absolute' }, style, selected && styles.selected, animatedStyle]}>
      <GestureDetector gesture={movePan}>
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={250}
          style={{
            flex: 1,
            borderRadius: dense ? 8 : 12,
            borderWidth: 1.5,
            borderColor: color,
            borderStyle: selected ? 'solid' : 'dotted',
            backgroundColor: `${color}1F`, // ~12% — more transparent than a session
            paddingHorizontal: dense ? 5 : 10,
            paddingVertical: compact ? 3 : 6,
            justifyContent: compact ? 'center' : 'flex-start',
          }}>
          <View className="flex-row items-center">
            {!dense && (
              <Ionicons
                name="time-outline"
                size={compact ? 11 : 13}
                color={color}
                style={{ marginRight: 4 }}
              />
            )}
            <Typography
              variant={compact || dense ? 'tiny-10' : 'body-12'}
              color="primary"
              numberOfLines={1}
              style={{ flex: 1, color }}>
              {name}
            </Typography>
          </View>
          {!compact && (
            <Typography variant="tiny-10" color="secondary" style={{ marginTop: 2, opacity: 0.9 }}>
              {dense ? formatTime(start) : `${formatTime(start)} · ${duration}m`}
            </Typography>
          )}
        </Pressable>
      </GestureDetector>

      {/* Resize grips, shown only while armed: the draggable area is the whole
          edge (full-width strip); the circle is just the visual affordance. */}
      {selected && (
        <>
          <GestureDetector gesture={topPan}>
            <View style={[styles.edgeGrip, { top: -EDGE_GRIP_HEIGHT / 2 }]}>
              <View style={[styles.handle, { borderColor: color, backgroundColor: handleFill }]} />
            </View>
          </GestureDetector>
          <GestureDetector gesture={bottomPan}>
            <View style={[styles.edgeGrip, { bottom: -EDGE_GRIP_HEIGHT / 2 }]}>
              <View style={[styles.handle, { borderColor: color, backgroundColor: handleFill }]} />
            </View>
          </GestureDetector>
        </>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  selected: {
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  edgeGrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: EDGE_GRIP_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  handle: {
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    borderWidth: 2,
  },
});
