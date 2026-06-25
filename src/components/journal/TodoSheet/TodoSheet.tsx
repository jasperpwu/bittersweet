import React, { FC, useMemo, useState, useCallback } from 'react';
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui/Typography';
import { showToast } from '../../ui/Toast';
import { colors } from '../../../config/theme';
import { useFocus, useTodos, useTodoActions } from '../../../store';
import type { Todo } from '../../../store/types';
import { TodoRow } from './TodoRow';
import { TodoEditModal } from './TodoEditModal';
import type { TodoScheduleController } from './TodoScheduleController';

const PEEK_HEIGHT = 54;
const FALLBACK_DURATION = 15;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TodoSheetProps {
  schedule?: TodoScheduleController;
}

export const TodoSheet: FC<TodoSheetProps> = ({ schedule }) => {
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  // Half-height sheet so the calendar/timeline stays visible above it.
  const sheetHeight = Math.round(screenHeight * 0.5);
  const collapsedY = sheetHeight - PEEK_HEIGHT;
  // Screen Y of the sheet's top edge when fully expanded (translateY === 0).
  const baseTop = screenHeight - sheetHeight;

  // While a row is being dragged, swap the "Add a TODO" row for a hint.
  const hintActive = !!schedule?.draggingTodo;

  const { tags, lastDurationByTagId } = useFocus();
  const todosState = useTodos();
  const { toggleTodo, deleteTodo, restoreTodo } = useTodoActions();

  const translateY = useSharedValue(collapsedY);
  const contextY = useSharedValue(0);
  const [expanded, setExpanded] = useState(false);
  // Latches once per drag so we collapse only the first time the todo leaves.
  const collapsedForDrag = useSharedValue(false);

  // Keep the drop floor in sync with the sheet's live top edge, so the valid
  // drop region grows as the sheet contracts.
  useAnimatedReaction(
    () => translateY.value,
    (ty) => {
      if (schedule) schedule.sheetTopY.value = baseTop + ty;
    },
    [schedule, baseTop]
  );

  // Contract the sheet the moment a dragged todo is lifted out of it onto the
  // calendar, giving the user the full timeline to aim at a slot.
  useAnimatedReaction(
    () => ({
      active: schedule?.dragActive.value ?? 0,
      y: schedule?.fingerY.value ?? 0,
    }),
    (cur) => {
      if (!schedule) return;
      if (cur.active === 0) {
        collapsedForDrag.value = false;
        return;
      }
      const currentTop = baseTop + translateY.value;
      if (!collapsedForDrag.value && cur.y < currentTop - 8) {
        collapsedForDrag.value = true;
        translateY.value = withTiming(collapsedY, { duration: 220 });
        runOnJS(setExpanded)(false);
      }
    },
    [schedule, baseTop, collapsedY]
  );

  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const activeTags = useMemo(
    () => tags.allIds.map((id) => tags.byId[id]).filter((tg) => tg && !tg.deletedAt),
    [tags]
  );

  const visibleTodos = useMemo(() => {
    const list = todosState.allIds
      .map((id) => todosState.byId[id])
      .filter((td): td is Todo => !!td && !td.deletedAt)
      .filter((td) => !filterTagId || td.tagId === filterTagId);
    // Incomplete first (by sortOrder), completed last (most recently done first).
    return list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.completed) {
        return new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime();
      }
      return a.sortOrder - b.sortOrder;
    });
  }, [todosState, filterTagId]);

  const snapTo = useCallback(
    (target: number) => {
      translateY.value = withTiming(target, { duration: 250 });
      setExpanded(target === 0);
    },
    [translateY]
  );

  const collapse = useCallback(() => snapTo(collapsedY), [snapTo, collapsedY]);
  const expand = useCallback(() => snapTo(0), [snapTo]);

  const toggleSheet = useCallback(() => {
    if (expanded) collapse();
    else expand();
  }, [expanded, collapse, expand]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.min(collapsedY, Math.max(0, contextY.value + event.translationY));
    })
    .onEnd((event) => {
      const midpoint = collapsedY / 2;
      const goingDown = event.velocityY > 400;
      const goingUp = event.velocityY < -400;
      const target =
        goingUp ? 0 : goingDown ? collapsedY : translateY.value < midpoint ? 0 : collapsedY;
      translateY.value = withTiming(target, { duration: 250 });
      runOnJS(setExpanded)(target === 0);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, collapsedY], [0.5, 0], Extrapolation.CLAMP),
  }));

  const openCreate = useCallback(() => {
    setEditingTodo(null);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setModalVisible(true);
  }, []);

  const handleDelete = useCallback(
    (todo: Todo) => {
      deleteTodo(todo.id);
      showToast(
        t('todos.deleted'),
        'neutral',
        {
          label: t('todos.undo'),
          onPress: () => restoreTodo(todo.id),
        },
        undefined,
        'bottom',
      );
    },
    [deleteTodo, restoreTodo, t]
  );

  const handleStart = useCallback(
    (todo: Todo) => {
      const duration =
        todo.durationMinutes ?? lastDurationByTagId?.[todo.tagId] ?? FALLBACK_DURATION;
      collapse();
      router.push({
        pathname: '/(tabs)',
        params: {
          startTagId: todo.tagId,
          startDuration: String(duration),
          autostart: '1',
          ts: String(Date.now()),
        },
      });
    },
    [lastDurationByTagId, collapse]
  );

  return (
    <>
      {/* Backdrop — taps collapse the sheet; ignores touches when collapsed */}
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, backdropStyle, { backgroundColor: '#000' }]}
        pointerEvents={expanded ? 'auto' : 'none'}
        onPress={collapse}
      />

      <Animated.View
        style={[styles.sheet, { height: sheetHeight }, sheetStyle]}
        className="absolute left-0 right-0 bottom-0 bg-light-bg dark:bg-dark-bg rounded-t-3xl"
      >
        {/* Header (drag + tap to toggle) */}
        <GestureDetector gesture={panGesture}>
          <Pressable onPress={toggleSheet}>
            <View className="items-center pt-2.5 pb-1">
              <View className="w-10 h-[5px] rounded-full bg-light-border dark:bg-dark-border" />
            </View>
            <View className="flex-row items-center justify-between px-5 pb-2">
              <Typography variant="subtitle-16" color="primary">
                {t('todos.title')}
              </Typography>
              <Ionicons
                name={expanded ? 'chevron-down' : 'chevron-up'}
                size={20}
                color={colors.textGrey}
              />
            </View>
          </Pressable>
        </GestureDetector>

        {/* Add a TODO — floating card; swaps to a drag hint while a row is held */}
        <View className="px-5 pb-2">
          {hintActive ? (
            <View
              style={styles.floatCard}
              className="flex-row items-center justify-center px-4 py-3 rounded-2xl border border-primary/40 bg-primary/10"
            >
              <Typography variant="body-14" color="primary" className="mr-1.5">
                {t('todos.dragHint')}
              </Typography>
              <Ionicons name="arrow-up" size={16} color={colors.primary} />
            </View>
          ) : (
            <Pressable
              onPress={openCreate}
              style={styles.floatCard}
              className="flex-row items-center px-4 py-3 rounded-2xl border border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg active:opacity-70"
            >
              <Ionicons name="add-circle" size={22} color={colors.primary} />
              <Typography variant="body-14" color="primary" className="ml-2">
                {t('todos.addRow')}
              </Typography>
            </Pressable>
          )}
        </View>

        {/* Rows */}
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {visibleTodos.length === 0 ? (
            <View className="items-center py-10">
              <Typography variant="body-12" color="secondary">
                {t('todos.empty')}
              </Typography>
            </View>
          ) : (
            visibleTodos.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                tag={tags.byId[todo.tagId] as any}
                onToggle={toggleTodo}
                onPressEdit={openEdit}
                onDelete={handleDelete}
                onStart={handleStart}
                schedule={schedule}
              />
            ))
          )}
        </ScrollView>

        {/* Tag filter pills */}
        <View className="py-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            <FilterPill
              label={t('todos.filterAll')}
              selected={filterTagId === null}
              onPress={() => setFilterTagId(null)}
            />
            {activeTags.map((tag) => (
              <FilterPill
                key={tag.id}
                label={`${tag.icon ? tag.icon + ' ' : ''}${tag.name}`}
                color={tag.color}
                selected={filterTagId === tag.id}
                onPress={() => setFilterTagId((prev) => (prev === tag.id ? null : tag.id))}
              />
            ))}
          </ScrollView>
        </View>
      </Animated.View>

      <TodoEditModal
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        todo={editingTodo}
        initialTagId={filterTagId}
      />
    </>
  );
};

interface FilterPillProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}

const FilterPill: FC<FilterPillProps> = ({ label, selected, onPress, color }) => (
  <Pressable
    onPress={onPress}
    className={`rounded-full px-3 py-1.5 ${
      selected ? 'bg-primary' : 'bg-black/5 dark:bg-white/10'
    }`}
    style={selected && color ? { backgroundColor: color } : undefined}
  >
    <Typography variant="body-12" color={selected ? 'white' : 'secondary'}>
      {label}
    </Typography>
  </Pressable>
);

const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 12,
  },
  floatCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
});
