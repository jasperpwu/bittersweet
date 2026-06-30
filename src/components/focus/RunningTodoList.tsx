import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, useColorScheme } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  FadeIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { colors } from '../../config/theme';
import { useAppStore } from '../../store';
import { showToast } from '../ui/Toast';
import type { Todo } from '../../store/types';

// Surfaced under the running focus timer: the active tag's open tasks, ordered by
// start time (via sortOrder), reorderable by long-press drag. Reordering persists
// through the same sortOrder field the Journal sheet reads, so the manual order
// sticks everywhere and syncs like the rest of the todo list.
//
// Intentionally NativeWind-free (inline styles + theme tokens): this subtree mounts
// during the session-start render cascade, and NativeWind's `className` components
// each run a `useInsertionEffect` to flush styles — mounting a batch of them in that
// commit (React 19 + Zustand 4) trips "useInsertionEffect must not schedule updates"
// and adds mount jank to the start transition. Inline styles avoid both.

const ROW_HEIGHT = 48; // row content (40) + gap (8)
const SPRING_CONFIG = { damping: 20, stiffness: 200, mass: 0.8 };
const MAX_LIST_HEIGHT = ROW_HEIGHT * 4.5; // ~4 rows, then scrolls

interface RunningTodoListProps {
  tagId: string;
  /** Tag color — used as the start-time accent so it matches the running tag. */
  accentColor?: string;
  /** Opens the create-todo sheet (preselected to the running tag). */
  onAddTodo?: () => void;
}

export const RunningTodoList: FC<RunningTodoListProps> = ({ tagId, accentColor, onAddTodo }) => {
  // Read the todo collection WITHOUT useSyncExternalStore. Zustand v4's useStore
  // subscribes through useSyncExternalStore, whose mount-time consistency check
  // can dispatch a forceUpdate while React is flushing insertion effects during
  // startTimer()'s synchronous set() cascade — that is the "useInsertionEffect
  // must not schedule updates" warning. An imperative subscribe set up in a
  // passive effect runs AFTER that commit, so it never schedules during the
  // insertion phase. (The real cure is Zustand v5, which is React-19-safe; this
  // keeps the fix scoped to the one component that mounts inside the cascade.)
  const [todosState, setTodosState] = useState(() => useAppStore.getState().focus.todos);
  useEffect(() => {
    const sync = () => {
      const next = useAppStore.getState().focus.todos;
      setTodosState((prev) => (prev === next ? prev : next));
    };
    sync(); // catch any change between initial render and this subscribe
    return useAppStore.subscribe(sync);
  }, []);
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const toggleTodo = useRef(useAppStore.getState().focus.toggleTodo).current;
  const reorderTodos = useRef(useAppStore.getState().focus.reorderTodos).current;

  // Completing a task drops it from the running list. Confirm with a success
  // haptic + a bottom toast carrying an Undo that flips it back open.
  const handleToggle = useCallback(
    (id: string) => {
      toggleTodo(id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(
        t('todos.completed'),
        'neutral',
        { label: t('todos.undo'), onPress: () => toggleTodo(id) },
        undefined,
        'bottom',
      );
    },
    [toggleTodo, t],
  );

  // The tag's open tasks, chronological by default (sortOrder seeds from startAt).
  const orderedTodos = useMemo(() => {
    return todosState.allIds
      .map((id) => todosState.byId[id])
      .filter((td): td is Todo => !!td && !td.deletedAt && !td.completed && td.tagId === tagId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [todosState, tagId]);

  const derivedIds = useMemo(() => orderedTodos.map((t) => t.id), [orderedTodos]);
  // Latest store order, read inside gesture handlers without re-subscribing.
  const derivedIdsRef = useRef<string[]>(derivedIds);
  derivedIdsRef.current = derivedIds;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOriginalIdx, setDragOriginalIdx] = useState(-1);
  const [dragTargetIdx, setDragTargetIdx] = useState(-1);
  const dragOriginalIdxRef = useRef(-1);
  const dragTargetIdxRef = useRef(-1);

  const handleDragStart = useCallback((index: number) => {
    setIsDragging(true);
    setDragOriginalIdx(index);
    setDragTargetIdx(index);
    dragOriginalIdxRef.current = index;
    dragTargetIdxRef.current = index;
  }, []);

  const handleDragMove = useCallback((translationY: number) => {
    const origIdx = dragOriginalIdxRef.current;
    const total = derivedIdsRef.current.length;
    const offset = Math.round(translationY / ROW_HEIGHT);
    const newTarget = Math.max(0, Math.min(total - 1, origIdx + offset));
    if (newTarget !== dragTargetIdxRef.current) {
      dragTargetIdxRef.current = newTarget;
      setDragTargetIdx(newTarget);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    const orig = dragOriginalIdxRef.current;
    const target = dragTargetIdxRef.current;
    if (orig !== target && orig >= 0 && target >= 0) {
      const newOrder = [...derivedIdsRef.current];
      const [moved] = newOrder.splice(orig, 1);
      newOrder.splice(target, 0, moved);
      // Persist straight to the store — Zustand's set is synchronous, so the next
      // render already reflects the new order; no local mirror state needed.
      reorderTodos(newOrder);
    }
    setIsDragging(false);
    setDragOriginalIdx(-1);
    setDragTargetIdx(-1);
    dragOriginalIdxRef.current = -1;
    dragTargetIdxRef.current = -1;
  }, [reorderTodos]);

  // Nothing to show when there are no open tasks and no way to add one.
  if (orderedTodos.length === 0 && !onAddTodo) return null;

  // Muted tone matching the rows' neutral icons/handles, so the add action reads
  // as a subtle affordance rather than clashing with the (arbitrary) tag accent.
  const addTint = isDark ? colors.dark.textSecondary : colors.light.textSecondary;
  // Card boundary matching the Journal todo cards: faint border token + a fill
  // that equals the SCREEN background (not the white `background` token), so the
  // fill is invisible and only the border + shadow read — exactly like the
  // Journal card, whose `bg-light-bg` fill matches the sheet behind it. The fill
  // is still needed for the shadow to render on the rounded rect (iOS).
  const cardBorder = isDark ? colors.dark.screenBorder : colors.light.screenBorder;
  const cardBg = isDark ? colors.dark.screen : colors.light.screen;

  return (
    <Reanimated.View
      entering={FadeIn.duration(550)}
      style={{ width: '100%', paddingHorizontal: 8 }}>
      {/* TODO list — card container matching the Journal todo cards (border token,
          filled surface, soft drop shadow). */}
      {orderedTodos.length > 0 && (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: cardBorder,
            backgroundColor: cardBg,
            paddingVertical: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 6,
            elevation: 3,
          }}>
          <ScrollView
            style={{ maxHeight: MAX_LIST_HEIGHT }}
            scrollEnabled={!isDragging}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {derivedIds.map((id, index) => {
              const todo = todosState.byId[id];
              if (!todo) return null;
              return (
                <TodoDragRow
                  key={id}
                  todo={todo}
                  index={index}
                  isLast={index === derivedIds.length - 1}
                  isDragging={isDragging}
                  dragOriginalIndex={dragOriginalIdx}
                  dragTargetIndex={dragTargetIdx}
                  accentColor={accentColor}
                  onToggle={handleToggle}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                />
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* "Add a TODO" action — plain row, no container. */}
      {onAddTodo && (
        <Pressable
          onPress={onAddTodo}
          hitSlop={8}
          style={{
            height: 44,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            marginTop: orderedTodos.length > 0 ? 4 : 0,
          }}>
          <Ionicons name="add" size={22} color={addTint} style={{ marginRight: 10 }} />
          <Text
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: addTint,
            }}>
            {t('todos.addRow')}
          </Text>
        </Pressable>
      )}
    </Reanimated.View>
  );
};

interface TodoDragRowProps {
  todo: Todo;
  index: number;
  /** Last row in the list — drops its bottom divider (also covers the single-task case). */
  isLast: boolean;
  isDragging: boolean;
  dragOriginalIndex: number;
  dragTargetIndex: number;
  accentColor?: string;
  onToggle: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragMove: (translationY: number) => void;
  onDragEnd: () => void;
}

const TodoDragRow: FC<TodoDragRowProps> = ({
  todo,
  index,
  isLast,
  isDragging,
  dragOriginalIndex,
  dragTargetIndex,
  accentColor,
  onToggle,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const isDark = useColorScheme() === 'dark';
  const isBeingDragged = isDragging && dragOriginalIndex === index;
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);
  const displacement = useSharedValue(0);
  const gestureActive = useSharedValue(false);

  // Snap back once the drag ends and the array has reordered.
  useEffect(() => {
    if (!isDragging) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      displacement.value = 0;
    }
  }, [isDragging]);

  // Slide non-dragged rows to open a gap for the dragged one.
  useEffect(() => {
    if (!isDragging || isBeingDragged) return;
    const orig = dragOriginalIndex;
    const target = dragTargetIndex;
    let shift = 0;
    if (orig < target && index > orig && index <= target) {
      shift = -ROW_HEIGHT;
    } else if (orig > target && index >= target && index < orig) {
      shift = ROW_HEIGHT;
    }
    displacement.value = withSpring(shift, SPRING_CONFIG);
  }, [isDragging, isBeingDragged, dragOriginalIndex, dragTargetIndex, index]);

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart(() => {
      gestureActive.value = true;
      scale.value = withSpring(1.03, SPRING_CONFIG);
      zIndex.value = 100;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(onDragStart)(index);
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      runOnJS(onDragMove)(e.translationY);
    })
    .onEnd(() => {
      gestureActive.value = false;
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
      runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      if (gestureActive.value) {
        translateY.value = withSpring(0, SPRING_CONFIG);
        gestureActive.value = false;
      }
      scale.value = withSpring(1, SPRING_CONFIG);
      zIndex.value = 0;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: isBeingDragged ? translateY.value : displacement.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  const timeLabel =
    todo.startAt && todo.startHasTime !== false
      ? new Date(todo.startAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : null;

  const accent = accentColor || colors.primary;
  const textPrimary = isDark ? colors.dark.textPrimary : colors.light.textPrimary;
  const textSecondary = isDark ? colors.dark.textSecondary : colors.light.textSecondary;
  const dividerColor = isDark ? colors.dark.screenBorder : colors.light.screenBorder;
  // Only the lifted (dragged) row needs an opaque fill so it doesn't show rows
  // beneath it; resting rows sit transparent on the focus screen. Use the screen
  // color so the lifted row blends with the card container instead of flashing white.
  const liftedBg = isDark ? colors.dark.screen : colors.light.screen;

  return (
    <GestureDetector gesture={panGesture}>
      <Reanimated.View
        style={[
          { height: 40, marginBottom: 8 },
          animatedStyle,
          isBeingDragged && {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
            elevation: 10,
          },
        ]}>
        <View
          style={{
            height: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: isBeingDragged ? liftedBg : 'transparent',
            borderBottomWidth: isBeingDragged || isLast ? 0 : 1,
            borderBottomColor: dividerColor,
          }}>
          {/* Checkbox — completes the task (drops it from the running list) */}
          <Pressable
            onPress={() => onToggle(todo.id)}
            hitSlop={10}
            style={{ marginRight: 10 }}>
            <Ionicons name="ellipse-outline" size={22} color={colors.textGrey} />
          </Pressable>

          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              fontSize: 14,
              fontFamily: 'Poppins-Regular',
              color: textPrimary,
            }}>
            {todo.name}
          </Text>

          {timeLabel && (
            <Text
              style={{
                marginLeft: 8,
                fontSize: 11,
                fontFamily: 'Poppins-Regular',
                color: accent,
              }}>
              {timeLabel}
            </Text>
          )}

          <Ionicons
            name="reorder-three"
            size={20}
            color={textSecondary}
            style={{ marginLeft: 8 }}
          />
        </View>
      </Reanimated.View>
    </GestureDetector>
  );
};
