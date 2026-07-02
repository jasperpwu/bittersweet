import React, { FC, useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
import { buildTodoSections } from '../../../utils/todoSections';
import { TodoRow } from './TodoRow';
import { TodoEditModal } from './TodoEditModal';
import type { TodoScheduleController } from './TodoScheduleController';

const PEEK_HEIGHT = 54;
const FALLBACK_DURATION = 15;
// Gap left below the safe-area top so the iOS status bar stays visible above
// the sheet even at full expansion.
const TOP_GAP = 8;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TodoSheetProps {
  schedule?: TodoScheduleController;
  // Changing value (e.g. a timestamp) requests the sheet expand to full height —
  // used by the TODO Home Screen widget deep link.
  expandSignal?: string | null;
  // Changing value requests opening the new-TODO modal — used by the TODO
  // widget's "+" button.
  createSignal?: string | null;
}

export const TodoSheet: FC<TodoSheetProps> = ({ schedule, expandSignal, createSignal }) => {
  const { t, i18n } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // The sheet lives inside the journal screen, which is itself inset above the
  // tab bar — so its available height excludes the tab bar, not just the safe
  // areas. Subtracting the tab bar height keeps the bottom-anchored sheet from
  // overshooting its top edge above the status bar.
  const tabBarHeight = useBottomTabBarHeight();
  const isDark = useColorScheme() === 'dark';
  // The sheet is rendered at full height (top stops below the safe-area top,
  // leaving the status bar visible) and bottom-anchored; translateY pushes it
  // down to reveal less of it. Three snap points: full (0), half (calendar/
  // timeline stays visible), and peek.
  const fullHeight = screenHeight - insets.top - TOP_GAP - tabBarHeight;
  const halfHeight = Math.round(screenHeight * 0.5);
  const collapsedY = fullHeight - PEEK_HEIGHT;
  const halfY = fullHeight - halfHeight;
  // Screen Y of the sheet's top edge when fully expanded (translateY === 0):
  // insets.top + TOP_GAP. Keeps `baseTop + translateY` the true on-screen top
  // so the schedule drag math stays identical at the peek/half positions.
  const baseTop = insets.top + TOP_GAP;

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

  // Bridges the list scroll position (JS) to the drag gesture (UI thread) so
  // the pan knows when the list is at its top.
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useSharedValue(0);
  // Anchors the sheet's position when a top-of-list pull-down takes over, and
  // latches so onEnd knows the pull (not a normal scroll) drove the sheet.
  const listContextY = useSharedValue(0);
  const listDriving = useSharedValue(false);

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
  // Completed section starts collapsed so finished tasks stay out of the way.
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  const activeTags = useMemo(
    () => tags.allIds.map((id) => tags.byId[id]).filter((tg) => tg && !tg.deletedAt),
    [tags]
  );

  // Group incomplete todos by their startAt date — Past, Today, one section per
  // future date, then No date — followed by a Completed section at the bottom.
  // Shared with the Home Screen TODO widget via buildTodoSections so both match.
  const sections = useMemo(() => {
    const all = todosState.allIds.map((id) => todosState.byId[id]).filter((td): td is Todo => !!td);
    return buildTodoSections(all, { filterTagId, t, lang: i18n.language });
  }, [todosState, filterTagId, t, i18n.language]);

  const snapTo = useCallback(
    (target: number) => {
      translateY.value = withTiming(target, { duration: 250 });
      setExpanded(target !== collapsedY);
    },
    [translateY, collapsedY]
  );

  const collapse = useCallback(() => snapTo(collapsedY), [snapTo, collapsedY]);
  // Tap-to-expand opens to the half position; dragging the handle further up
  // reaches full screen.
  const expand = useCallback(() => snapTo(halfY), [snapTo, halfY]);

  const toggleSheet = useCallback(() => {
    if (expanded) collapse();
    else expand();
  }, [expanded, collapse, expand]);

  // Expand to full height when the TODO widget deep link requests it. The signal
  // value changes per tap, so re-tapping the widget re-expands a collapsed sheet.
  useEffect(() => {
    if (expandSignal) snapTo(0);
  }, [expandSignal, snapTo]);

  // Mirror the list's scroll offset onto the UI thread so the drag gesture can
  // tell whether the list is at its top.
  const handleListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.value = e.nativeEvent.contentOffset.y;
    },
    [scrollY]
  );

  const panGesture = Gesture.Pan()
    .onStart(() => {
      contextY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateY.value = Math.min(collapsedY, Math.max(0, contextY.value + event.translationY));
    })
    .onEnd((event) => {
      // Project where the throw would land, then snap to the nearest of the
      // three stops (full / half / peek) so an upward flick reaches full screen.
      const projected = translateY.value + event.velocityY * 0.08;
      const points = [0, halfY, collapsedY];
      let target = points[0];
      let best = Math.abs(projected - points[0]);
      for (let i = 1; i < points.length; i++) {
        const d = Math.abs(projected - points[i]);
        if (d < best) {
          best = d;
          target = points[i];
        }
      }
      translateY.value = withTiming(target, { duration: 250 });
      runOnJS(setExpanded)(target !== collapsedY);
    });

  // Drag on the list itself: once it's scrolled to the top, a downward pull
  // drives the whole sheet down instead of (uselessly) overscrolling the list.
  // Runs simultaneously with the ScrollView's native gesture so vertical
  // scrolling within the list is unaffected.
  const listPanGesture = Gesture.Pan()
    .onUpdate((event) => {
      const atTop = scrollY.value <= 0;
      if (!listDriving.value) {
        // Only take over when expanded, at the top, and pulling downward.
        if (atTop && event.translationY > 0 && translateY.value < collapsedY) {
          listDriving.value = true;
          // Anchor so the sheet stays put at the moment of takeover (no jump).
          listContextY.value = translateY.value - event.translationY;
        } else {
          return;
        }
      }
      translateY.value = Math.min(
        collapsedY,
        Math.max(0, listContextY.value + event.translationY)
      );
    })
    .onEnd((event) => {
      if (!listDriving.value) return;
      listDriving.value = false;
      // A top-of-list pull only drives the sheet downward; snap to the nearest
      // stop at or below where the throw projects (half or peek).
      const projected = translateY.value + event.velocityY * 0.08;
      const points = [0, halfY, collapsedY];
      let target = points[0];
      let best = Math.abs(projected - points[0]);
      for (let i = 1; i < points.length; i++) {
        const d = Math.abs(projected - points[i]);
        if (d < best) {
          best = d;
          target = points[i];
        }
      }
      translateY.value = withTiming(target, { duration: 250 });
      runOnJS(setExpanded)(target !== collapsedY);
    })
    .onFinalize(() => {
      listDriving.value = false;
    })
    .simultaneousWithExternalGesture(
      scrollRef as unknown as React.RefObject<React.ComponentType>
    );

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

  // Open the new-TODO modal when the widget's "+" requests it (and expand the
  // sheet so it's visible behind the modal). The signal changes per tap.
  useEffect(() => {
    if (createSignal) {
      snapTo(0);
      openCreate();
    }
  }, [createSignal, snapTo, openCreate]);

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
      // navigate() switches to the already-mounted focus tab in place; push() adds a
      // stack entry and runs a full push transition + re-render of the heavy focus
      // screen, which is the lag before the jump.
      router.navigate({
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
        style={[styles.sheet, { height: fullHeight }, sheetStyle]}
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
        <GestureDetector gesture={listPanGesture}>
          <ScrollView
            ref={scrollRef}
            className="flex-1 px-5"
            contentContainerStyle={{ paddingTop: 4 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            // No top overscroll bounce — a downward pull at the top drives the
            // sheet (via listPanGesture) rather than rubber-banding the list.
            bounces={false}
          >
          {sections.length === 0 ? (
            <View className="items-center py-10">
              <Typography variant="body-12" color="secondary">
                {t('todos.empty')}
              </Typography>
            </View>
          ) : (
            sections.map((section) => {
              const collapsed = section.collapsible && completedCollapsed;
              const Header = section.collapsible ? Pressable : View;
              return (
                <View key={section.key}>
                  <Header
                    onPress={
                      section.collapsible
                        ? () => setCompletedCollapsed((v) => !v)
                        : undefined
                    }
                    className="flex-row items-center justify-between pt-4 pb-1.5"
                  >
                    <View className="flex-row items-center">
                      <Typography variant="subtitle-14-semibold" color="secondary">
                        {section.title}
                      </Typography>
                      <Typography variant="body-12" color="secondary" className="ml-1.5">
                        {section.todos.length}
                      </Typography>
                    </View>
                    {section.collapsible && (
                      <Ionicons
                        name={collapsed ? 'chevron-down' : 'chevron-up'}
                        size={16}
                        color={isDark ? colors.dark.textSecondary : colors.light.textSecondary}
                      />
                    )}
                  </Header>
                  {!collapsed &&
                    section.todos.map((todo) => (
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
                    ))}
                </View>
              );
            })
          )}
          </ScrollView>
        </GestureDetector>

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
