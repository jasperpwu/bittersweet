import { FC } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../ui/Typography';
import { colors } from '../../../config/theme';
import { useFocus } from '../../../store';
import type { TodoScheduleController } from './TodoScheduleController';
import { PIXELS_PER_MINUTE } from '../Timeline/constants';

// Fallback pill width before the timeline has reported its slot geometry.
const FALLBACK_WIDTH = 180;
const MIN_HEIGHT = 36;
// Where the fingertip sits relative to the card's top — keeps it "held" near the
// top edge so the card hangs downward like the slot it'll occupy.
const FINGER_TOP_OFFSET = 14;

interface Props {
  schedule: TodoScheduleController;
}

/**
 * A card that tracks the finger while a TODO is dragged from the sheet toward
 * the calendar. It grows to the exact size of the slot it would drop into (same
 * width as a calendar block, height = duration), so it previews the landing.
 * Rendered at the screen root (above the sheet); purely visual, never touchable.
 */
export const TodoDragGhost: FC<Props> = ({ schedule }) => {
  const { draggingTodo } = schedule;
  const { tags } = useFocus();
  const tag = draggingTodo ? tags.byId[draggingTodo.tagId] : undefined;
  const color = tag?.color ?? colors.primary;

  const style = useAnimatedStyle(() => {
    const dayW = schedule.tlDayWidth.value;
    const slotW = dayW - schedule.tlSlotPad.value * 2;
    const width = slotW > 0 ? slotW : FALLBACK_WIDTH;
    const height = Math.max(schedule.durationMin.value * PIXELS_PER_MINUTE, MIN_HEIGHT);
    // When the timeline geometry is known, align horizontally to the day column
    // under the finger (snapping between columns in the 3-day view); otherwise
    // center on the finger.
    let left = schedule.fingerX.value - width / 2;
    if (slotW > 0) {
      const col = Math.max(
        0,
        Math.min(
          schedule.tlNumDays.value - 1,
          Math.floor((schedule.fingerX.value - schedule.tlDaysLeftX.value) / dayW)
        )
      );
      left = schedule.tlDaysLeftX.value + col * dayW + schedule.tlSlotPad.value;
    }
    return {
      opacity: schedule.dragActive.value,
      width: withTiming(width, { duration: 140 }),
      height: withTiming(height, { duration: 140 }),
      transform: [
        { translateX: left },
        { translateY: schedule.fingerY.value - FINGER_TOP_OFFSET },
      ],
    };
  });

  if (!draggingTodo) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ghost, { borderColor: color, backgroundColor: `${color}26` }, style]}
    >
      <Ionicons name="time-outline" size={14} color={color} style={{ marginRight: 6, marginTop: 1 }} />
      <Typography variant="body-12" color="primary" numberOfLines={1} style={{ flex: 1, color }}>
        {draggingTodo.name}
      </Typography>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  ghost: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 999,
  },
});
