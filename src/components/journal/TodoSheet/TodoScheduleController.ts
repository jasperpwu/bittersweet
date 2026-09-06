import { useCallback, useMemo, useRef, useState } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { Todo } from '../../../store/types';
import { ensureTodoNotificationPermission } from '../../../services/notifications/todos';
import { DEFAULT_TODO_DURATION, BLOCK_H_PADDING } from '../Timeline/constants';

/**
 * Shared state + callbacks that wire the TODO sheet's drag-to-schedule gesture
 * to the calendar Timeline. Created once in the Journal screen and handed to both
 * the Timeline (reads metrics + draws the drop indicator) and the sheet rows
 * (write the finger position and commit on release).
 *
 * Reanimated shared values carry per-frame drag state on the UI thread; the JS
 * callbacks run the actual store writes.
 *
 * Day-column geometry: the mounted calendar view reports its layout as
 * "`tlNumDays` columns starting at `tlDaysLeftX`, each `tlDayWidth` wide". The
 * single-day Sessions timeline reports one full-width column; the 3-day TODOs
 * view reports three. Finger X → day index and finger Y → minute-of-day both
 * derive from these values, so the same drag gesture works against either view.
 */
/**
 * Worklet-safe summary of the row being dragged. Primitives only, deliberately:
 * the controller object below is captured by the sheet, both timelines, the drag
 * ghost and every row's drag gesture, and a worklet copies the WHOLE captured
 * object. A `Date` anywhere on it (a full `Todo` carries `startAt`,
 * `createdAt`, `updatedAt`) crashes every one of them with
 * "[Worklets] Cannot copy value of type `Date`". The full `Todo` stays in a ref
 * inside the controller, where only the JS callbacks read it.
 */
export interface DraggingTodoSummary {
  id: string;
  name: string;
  tagId: string;
}

/** Nothing on this object may carry a `Date` — see DraggingTodoSummary. */
export interface TodoScheduleController {
  // --- UI-thread drag state ---
  dragActive: SharedValue<number>; // 0 | 1
  fingerX: SharedValue<number>; // absolute screen X of the finger
  fingerY: SharedValue<number>; // absolute screen Y of the finger
  durationMin: SharedValue<number>; // slot length of the dragged todo (minutes)

  // --- Timeline metrics (reported by the mounted calendar view) ---
  tlPageY: SharedValue<number>; // screen Y of the timeline scroll viewport top
  tlScrollY: SharedValue<number>; // current vertical scroll offset of the timeline
  tlHeight: SharedValue<number>; // height of the timeline scroll viewport
  sheetTopY: SharedValue<number>; // screen Y of the sheet's top edge (drop floor)
  tlDaysLeftX: SharedValue<number>; // screen X where the day columns start (after the time gutter)
  tlDayWidth: SharedValue<number>; // width of one day column
  tlNumDays: SharedValue<number>; // number of day columns (1 = Sessions view, 3 = TODOs view)
  tlSlotPad: SharedValue<number>; // inner horizontal padding of a block within its column

  // --- Reposition preview (dragging an existing block within the calendar) ---
  previewActive: SharedValue<number>; // 0 | 1
  previewMinutes: SharedValue<number>; // snapped start minute-of-day of the target slot
  previewDuration: SharedValue<number>; // slot length (minutes)
  previewDayIndex: SharedValue<number>; // which day column the previewed block lives in

  // --- JS state / callbacks ---
  draggingTodo: DraggingTodoSummary | null; // non-null while a sheet row is being dragged
  beginDrag: (todo: Todo) => void;
  commitSchedule: (minutes: number, inRange: boolean, dayIndex?: number) => void;
  cancelDrag: () => void;
  rescheduleTodo: (
    todoId: string,
    minutes: number,
    baseDate?: Date,
    durationMinutes?: number
  ) => void;
  openEditTodo: (todo: Todo) => void;
}

interface ControllerDeps {
  selectedDate: Date;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  onEditTodo: (todo: Todo) => void;
  /** Fired when a sheet row starts being dragged (used to switch to the TODOs view). */
  onDragStart?: () => void;
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
  onDragStart,
}: ControllerDeps): TodoScheduleController {
  const dragActive = useSharedValue(0);
  const fingerX = useSharedValue(0);
  const fingerY = useSharedValue(0);
  const durationMin = useSharedValue(DEFAULT_TODO_DURATION);
  const tlPageY = useSharedValue(0);
  const tlScrollY = useSharedValue(0);
  const tlHeight = useSharedValue(0);
  const sheetTopY = useSharedValue(0);
  const tlDaysLeftX = useSharedValue(0);
  const tlDayWidth = useSharedValue(0);
  const tlNumDays = useSharedValue(1);
  const tlSlotPad = useSharedValue(BLOCK_H_PADDING);
  const previewActive = useSharedValue(0);
  const previewMinutes = useSharedValue(0);
  const previewDuration = useSharedValue(DEFAULT_TODO_DURATION);
  const previewDayIndex = useSharedValue(0);

  const [draggingTodo, setDraggingTodo] = useState<DraggingTodoSummary | null>(null);
  // Latest values read inside gesture callbacks (which capture stale closures).
  const draggingRef = useRef<Todo | null>(null);
  const selectedDateRef = useRef(selectedDate);
  selectedDateRef.current = selectedDate;

  const beginDrag = useCallback(
    (todo: Todo) => {
      draggingRef.current = todo;
      durationMin.value = todo.durationMinutes ?? DEFAULT_TODO_DURATION;
      dragActive.value = 1;
      setDraggingTodo({ id: todo.id, name: todo.name, tagId: todo.tagId });
      onDragStart?.();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [dragActive, durationMin, onDragStart]
  );

  const cancelDrag = useCallback(() => {
    dragActive.value = 0;
    draggingRef.current = null;
    setDraggingTodo(null);
  }, [dragActive]);

  const commitSchedule = useCallback(
    (minutes: number, inRange: boolean, dayIndex: number = 0) => {
      const todo = draggingRef.current;
      dragActive.value = 0;
      draggingRef.current = null;
      setDraggingTodo(null);
      if (!todo || !inRange) return;
      // The drop day is the visible column under the finger: the first column
      // is the selected date, subsequent columns the following days.
      const dropDay = new Date(selectedDateRef.current);
      dropDay.setDate(dropDay.getDate() + dayIndex);
      // Dropping onto the timeline pins a concrete time → mark it as timed.
      updateTodo(todo.id, {
        startAt: dateAtMinutes(dropDay, minutes),
        startHasTime: true,
      });
      // Scheduling a start implies wanting a reminder — ask quietly (no alert
      // mid-gesture; the edit modal handles the denied-Settings path).
      ensureTodoNotificationPermission();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [dragActive, updateTodo]
  );

  const rescheduleTodo = useCallback(
    (todoId: string, minutes: number, baseDate?: Date, durationMinutes?: number) => {
      updateTodo(todoId, {
        startAt: dateAtMinutes(baseDate ?? selectedDateRef.current, minutes),
        startHasTime: true,
        // Present when the commit came from a resize (edge drag) — moves keep it.
        ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      });
      ensureTodoNotificationPermission();
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
      tlDaysLeftX,
      tlDayWidth,
      tlNumDays,
      tlSlotPad,
      previewActive,
      previewMinutes,
      previewDuration,
      previewDayIndex,
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
      tlDaysLeftX,
      tlDayWidth,
      tlNumDays,
      tlSlotPad,
      previewActive,
      previewMinutes,
      previewDuration,
      previewDayIndex,
      draggingTodo,
      beginDrag,
      commitSchedule,
      cancelDrag,
      rescheduleTodo,
      onEditTodo,
    ]
  );
}
