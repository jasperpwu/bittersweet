import React, { FC, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui/Typography';
import { colors } from '../../../config/theme';
import type { Todo } from '../../../store/types';
import type { SessionTag } from '../../../types/models';
import type { TodoScheduleController } from './TodoScheduleController';
import { PIXELS_PER_MINUTE, SNAP_MINUTES, END_HOUR, DEFAULT_TODO_DURATION } from '../Timeline/constants';

const DAY_END_MINUTES = (END_HOUR + 1) * 60;

interface TodoRowProps {
  todo: Todo;
  tag?: SessionTag;
  onToggle: (id: string) => void;
  onPressEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
  onStart: (todo: Todo) => void;
  schedule?: TodoScheduleController;
}

// Past this drag distance the action commits on release (iOS-Mail style).
const ACTION_THRESHOLD = 96;

// The colored action panel that sits behind the row. Its icon scales + fades in
// with swipe progress, and it aligns to the edge the row is being pulled from.
interface ActionPanelProps {
  progress: SharedValue<number>;
  align: 'left' | 'right';
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}

const ActionPanel: FC<ActionPanelProps> = ({ progress, align, color, icon, label }) => {
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0, 0.6, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.7, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View
      className="flex-1 mb-2.5 rounded-2xl justify-center"
      style={{
        backgroundColor: color,
        alignItems: align === 'left' ? 'flex-start' : 'flex-end',
        paddingHorizontal: 22,
      }}
    >
      <Animated.View style={iconStyle} className="items-center">
        <Ionicons name={icon} size={22} color={colors.white} />
        <Typography variant="tiny-10" color="white">
          {label}
        </Typography>
      </Animated.View>
    </View>
  );
};

export const TodoRow: FC<TodoRowProps> = ({ todo, tag, onToggle, onPressEdit, onDelete, onStart, schedule }) => {
  const { t } = useTranslation();
  const swipeableRef = useRef<any>(null);
  const didSwipe = useRef(false);
  const firedRef = useRef(false);

  // Long-press picks the row up and drags it onto the calendar to schedule it.
  // A quick horizontal flick still triggers the swipe actions below, because
  // the drag only activates after a stationary long press.
  const dragGesture = Gesture.Pan()
    .enabled(!!schedule)
    .activateAfterLongPress(240)
    .onStart((e) => {
      if (!schedule) return;
      // Set the UI-thread drag state immediately so the ghost + indicator show
      // without waiting for the JS round-trip; beginDrag handles haptic + state.
      schedule.fingerX.value = e.absoluteX;
      schedule.fingerY.value = e.absoluteY;
      schedule.durationMin.value = todo.durationMinutes ?? DEFAULT_TODO_DURATION;
      schedule.dragActive.value = 1;
      runOnJS(schedule.beginDrag)(todo);
    })
    .onUpdate((e) => {
      if (!schedule) return;
      schedule.fingerX.value = e.absoluteX;
      schedule.fingerY.value = e.absoluteY;
    })
    .onEnd(() => {
      if (!schedule) return;
      const { fingerY, tlPageY, tlScrollY, tlHeight, sheetTopY, durationMin } = schedule;
      const contentY = fingerY.value - tlPageY.value + tlScrollY.value;
      const snapped = Math.round(contentY / PIXELS_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES;
      const minutes = Math.max(0, Math.min(DAY_END_MINUTES - durationMin.value, snapped));
      const floor = Math.min(tlPageY.value + tlHeight.value, sheetTopY.value);
      const inRange = fingerY.value >= tlPageY.value && fingerY.value <= floor;
      runOnJS(schedule.commitSchedule)(minutes, inRange);
    })
    .onFinalize((_e, success) => {
      // Safety net: if the gesture is cancelled before onEnd, drop the drag state.
      if (schedule && !success) runOnJS(schedule.cancelDrag)();
    });

  // Swiping LEFT (row pulled left → right-side panel) starts a focus session.
  const renderRightActions = (progress: SharedValue<number>) => (
    <ActionPanel progress={progress} align="right" color={colors.primary} icon="play" label={t('todos.start')} />
  );

  // Swiping RIGHT (row pulled right → left-side panel) deletes the task.
  const renderLeftActions = (progress: SharedValue<number>) => (
    <ActionPanel progress={progress} align="left" color={colors.error} icon="trash" label={t('common.delete')} />
  );

  // Full-swipe commit: the gesture itself performs the action once it crosses the
  // threshold — no second tap on a revealed button.
  // NOTE: ReanimatedSwipeable reports `direction` by the row's translation sign,
  // which is the OPPOSITE of which panel is revealed: swiping RIGHT (left panel /
  // Delete visible) reports 'right'; swiping LEFT (right panel / Start visible)
  // reports 'left'.
  const handleWillOpen = (direction: 'left' | 'right') => {
    if (firedRef.current) return;
    firedRef.current = true;
    didSwipe.current = true;
    if (direction === 'right') {
      // swiped right → left-side panel (Delete) revealed
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onDelete(todo);
    } else {
      // swiped left → right-side panel (Start) revealed
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onStart(todo);
      swipeableRef.current?.close();
    }
  };

  const handlePress = () => {
    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }
    onPressEdit(todo);
  };

  return (
    <GestureDetector gesture={dragGesture}>
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      leftThreshold={ACTION_THRESHOLD}
      rightThreshold={ACTION_THRESHOLD}
      overshootFriction={8}
      onSwipeableWillOpen={handleWillOpen}
      onSwipeableClose={() => {
        firedRef.current = false;
        setTimeout(() => { didSwipe.current = false; }, 100);
      }}
    >
      <Pressable
        onPress={handlePress}
        style={styles.card}
        className="flex-row items-center px-3.5 py-3.5 mb-2.5 rounded-2xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg"
      >
        {/* Checkbox */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle(todo.id);
          }}
          hitSlop={10}
          className="mr-3 active:opacity-70"
        >
          <Ionicons
            name={todo.completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={todo.completed ? colors.success : colors.textGrey}
          />
        </Pressable>

        {/* Name */}
        <View className="flex-1 mr-2">
          <Typography
            variant="body-14"
            color={todo.completed ? 'secondary' : 'primary'}
            numberOfLines={1}
            style={todo.completed ? { textDecorationLine: 'line-through' } : undefined}
          >
            {todo.name}
          </Typography>
        </View>

        {/* Tag pill */}
        {tag && (
          <View
            className="flex-row items-center rounded-full px-2.5 py-1"
            style={{ backgroundColor: `${tag.color}22` }}
          >
            {!!tag.icon && (
              <Typography variant="tiny-10" color="primary" className="mr-1">
                {tag.icon}
              </Typography>
            )}
            <Typography variant="tiny-10" color="primary" style={{ color: tag.color }}>
              {tag.name}
            </Typography>
          </View>
        )}
      </Pressable>
    </Swipeable>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
});
