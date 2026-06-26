import { useCallback, useMemo, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { Todo } from '../../../store/types';
import { DEFAULT_TODO_DURATION } from '../Timeline/constants';

/**
 * Shared state + callbacks that wire the TODO sheet's drag-to-schedule gesture
 * to the calendar Timeline. Created once in the Journal screen and handed to both
 * the Timeline (reads metrics + draws the drop indicator) and the sheet rows
 * (write the finger position and commit on release).
 *
 * Reanimated shared values carry per-frame drag state on the UI thread; the JS
 * callbacks run the actual store writes.
 */
export interface TodoScheduleController {
  // --- UI-thread drag state ---
  dragActive: SharedValue<number>; // 0 | 1
  fingerX: SharedValue<number>; // absolute screen X of the finger
  fingerY: SharedValue<number>; // absolute screen Y of the finger
  durationMin: SharedValue<number>; // slot length of the dragged todo (minutes)

  // --- Timeline metrics (reported by the Timeline) ---
  tlPageY: SharedValue<number>; // screen Y of the timeline scroll viewport top
  tlScrollY: SharedValue<number>; // current vertical scroll offset of the timeline
  tlHeight: SharedValue<number>; // height of the timeline scroll viewport
  sheetTopY: SharedValue<number>; // screen Y of the sheet's top edge (drop floor)
  tlSlotLeftX: SharedValue<number>; // screen X of a block's left edge in the content area
  tlSlotWidth: SharedValue<number>; // width a dropped block occupies (matches the indicator)

  // --- Reposition preview (dragging an existing block within the calendar) ---
  previewActive: SharedValue<number>; // 0 | 1
  previewMinutes: SharedValue<number>; // snapped start minute-of-day of the target slot
  previewDuration: SharedValue<number>; // slot length (minutes)

  // --- JS state / callbacks ---
  draggingTodo: Todo | null; // non-null while a sheet row is being dragged
  beginDrag: (todo: Todo) => void;
  commitSchedule: (minutes: number, inRange: boolean) => void;
  cancelDrag: () => void;
  rescheduleTodo: (todoId: string, minutes: number) => void;
  openEditTodo: (todo: Todo) => void;
}

interface ControllerDeps {
  selectedDate: Date;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  onEditTodo: (todo: Todo) => void;
}

/** Build a Date on `base`'s calendar day at the given minutes-from-midnight. */
const dateAtMinutes = (base: Date, minutes: number): Date => {
  const d = new Date(base);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

export function useTodoScheduleController({
  selectedDate,
  updateTodo,
  onEditTodo,
}: ControllerDeps): TodoScheduleController {
  const dragActive = useSharedValue(0);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const durationMin = useSharedValue(DEFAULT_TODO_DURATION);
  const tlPageY = useSharedValue(0);
  const tlScrollY = useSharedValue(0);
  const tlHeight = useSharedValue(0);
  const sheetTopY = useSharedValue(0);
  const tlSlotLeftX = useSharedValue(0);
  const tlSlotWidth = useSharedValue(0);
  const previewActive = useSharedValue(0);
  const previewMinutes = useSharedValue(0);
  const previewDuration = useSharedValue(DEFAULT_TODO_DURATION);

  const [draggingTodo, setDraggingTodo] = useState<Todo | null>(null);
  // Latest values read inside gesture callbacks (which capture stale closures).
  const draggingRef = useRef<Todo | null>(null);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  const beginDrag = useCallback(
    (todo: Todo) => {
      draggingRef.current = todo;
      durationMin.value = todo.durationMinutes ?? DEFAULT_TODO_DURATION;
      dragActive.value = 1;
      setDraggingTodo(todo);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [dragActive, durationMin]
  );

  const cancelDrag = useCallback(() => {
    dragActive.value = 0;
    draggingRef.current = null;
    setDraggingTodo(null);
  }, [dragActive]);

  const commitSchedule = useCallback(
    (minutes: number, inRange: boolean) => {
      const todo = draggingRef.current;
      dragActive.value = 0;
      draggingRef.current = null;
      setDraggingTodo(null);
      if (!todo || !inRange) return;
      // Dropping onto the timeline pins a concrete time → mark it as timed.
      updateTodo(todo.id, {
        startAt: dateAtMinutes(selectedDateRef.current, minutes),
        startHasTime: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [dragActive, updateTodo]
  );

  const rescheduleTodo = useCallback(
    (todoId: string, minutes: number) => {
      updateTodo(todoId, {
        startAt: dateAtMinutes(selectedDateRef.current, minutes),
        startHasTime: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [updateTodo]
  );

  return useMemo(
    () => ({
      dragActive,
      fingerX,
      fingerY,
      durationMin,
      tlPageY,
      tlScrollY,
      tlHeight,
      sheetTopY,
      tlSlotLeftX,
      tlSlotWidth,
      previewActive,
      previewMinutes,
      previewDuration,
      draggingTodo,
      beginDrag,
      commitSchedule,
      cancelDrag,
      rescheduleTodo,
      openEditTodo: onEditTodo,
    }),
    [
      dragActive,
      fingerX,
      fingerY,
      durationMin,
      tlPageY,
      tlScrollY,
      tlHeight,
      sheetTopY,
      tlSlotLeftX,
      tlSlotWidth,
      previewActive,
      previewMinutes,
      previewDuration,
      draggingTodo,
      beginDrag,
      commitSchedule,
      cancelDrag,
      rescheduleTodo,
      onEditTodo,
    ]
  );
}
