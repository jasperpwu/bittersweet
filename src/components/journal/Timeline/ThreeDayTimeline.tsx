import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, useColorScheme } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Typography } from '../../ui/Typography';
import { ScheduledTodoBlock } from '../SessionBlock';
import type { Todo } from '../../../store/types';
import type { TodoScheduleController } from '../TodoSheet/TodoScheduleController';
import { colors } from '../../../config/theme';
import { isToday } from '../../../utils/dateUtils';
import {
  START_HOUR,
  END_HOUR,
  TOTAL_HOURS,
  HOUR_HEIGHT,
  PIXELS_PER_MINUTE,
  SNAP_MINUTES,
  DEFAULT_TODO_DURATION,
  THREE_DAY_COUNT,
  THREE_DAY_TIME_COLUMN_WIDTH,
  THREE_DAY_BLOCK_H_PADDING,
} from './constants';
import { computeOverlapColumns } from './overlapColumns';

interface ThreeDayTimelineProps {
  /** First visible day; the view shows this day plus the following two. */
  startDate: Date;
  /** Scheduled (timed) todos falling anywhere within the 3-day window. */
  todos: Todo[];
  currentTime: Date;
  schedule?: TodoScheduleController;
  onTodoPress?: (todo: Todo) => void;
  onTodoReschedule?: (todoId: string, minutes: number, day: Date, durationMinutes?: number) => void;
}

const DAY_END_MINUTES = (END_HOUR + 1) * 60;

// Horizontal gap between side-by-side blocks when todos overlap in time
// (tighter than the single-day view's — the 3-day columns are narrow).
const BLOCK_GAP = 2;

const AnimatedScrollView = Animated.ScrollView;

// Short gutter label ("12 AM", "3 PM") — the 3-day gutter is too narrow for ":00".
const formatHourShort = (hour: number) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour} ${period}`;
};

const getTopPosition = (startTime: Date) => {
  const minutes = startTime.getHours() * 60 + startTime.getMinutes();
  return Math.max(0, (minutes - START_HOUR * 60) * PIXELS_PER_MINUTE);
};

/**
 * The TODOs calendar: three side-by-side day columns (selected date + next two
 * days) showing scheduled TODO blocks. Shares the drag-to-schedule controller
 * with the sheet — it reports its column geometry so a dragged todo's finger X
 * picks the drop day and finger Y the time.
 */
export const ThreeDayTimeline: FC<ThreeDayTimelineProps> = ({
  startDate,
  todos,
  currentTime,
  schedule,
  onTodoPress,
  onTodoReschedule,
}) => {
  const { i18n } = useTranslation();
  const colorScheme = useColorScheme();
  const rootRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  // Measured width of the day-columns area, used to place blocks/indicators.
  const [contentWidth, setContentWidth] = useState(0);
  const colWidth = contentWidth / THREE_DAY_COUNT;

  // Block armed for move/resize (long-pressed). Owned here so only one block is
  // editable at a time and scrolling pauses while its pan gestures are active.
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  useEffect(() => {
    if (editingTodoId && !todos.some((td) => td.id === editingTodoId)) {
      setEditingTodoId(null);
    }
  }, [editingTodoId, todos]);

  const days = useMemo(() => {
    return Array.from({ length: THREE_DAY_COUNT }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [startDate]);

  // Bucket todos into their day column and lay out time-overlapping ones
  // side by side (same cluster/column algorithm as the sessions timeline).
  const todosByDay = useMemo(() => {
    return days.map((day) => {
      const dayStr = day.toDateString();
      const dayTodos = todos
        .filter((td) => td.startAt && new Date(td.startAt).toDateString() === dayStr)
        .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
      const layout = computeOverlapColumns(
        dayTodos.map((td) => {
          const start = new Date(td.startAt!).getTime();
          const duration = td.durationMinutes ?? DEFAULT_TODO_DURATION;
          return { id: td.id, start, end: start + duration * 60_000 };
        })
      );
      return { todos: dayTodos, layout };
    });
  }, [days, todos]);

  const hourSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) slots.push(hour);
    return slots;
  }, []);

  const todayIndex = days.findIndex((d) => isToday(d));
  const showCurrentTimeIndicator =
    todayIndex >= 0 && currentTime.getHours() >= START_HOUR && currentTime.getHours() <= END_HOUR;
  const currentTimePosition = getTopPosition(currentTime);

  // Keep the schedule controller's view of our scroll offset current (UI thread).
  const scrollHandler = useAnimatedScrollHandler((e) => {
    if (schedule) schedule.tlScrollY.value = e.contentOffset.y;
  });

  // A freshly mounted timeline starts at offset 0, but the shared value may
  // still hold the previous view's offset (views swap when switching tabs).
  useEffect(() => {
    if (schedule) schedule.tlScrollY.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Report viewport + day-column geometry so the sheet's drag gesture can map
  // a finger position to (day, minute-of-day).
  const measureViewport = () => {
    if (!schedule) return;
    rootRef.current?.measureInWindow((x, y, w, h) => {
      schedule.tlPageY.value = y;
      schedule.tlHeight.value = h;
      schedule.tlDaysLeftX.value = x + THREE_DAY_TIME_COLUMN_WIDTH;
      schedule.tlDayWidth.value = Math.max(0, (w - THREE_DAY_TIME_COLUMN_WIDTH) / THREE_DAY_COUNT);
      schedule.tlNumDays.value = THREE_DAY_COUNT;
      schedule.tlSlotPad.value = THREE_DAY_BLOCK_H_PADDING;
    });
  };

  // Live drop indicator: dotted slot outline in the hovered day column while
  // dragging in from the sheet, or in the block's own column while repositioning.
  const indicatorStyle = useAnimatedStyle(() => {
    if (!schedule) return { opacity: 0 };
    const {
      dragActive,
      fingerX,
      fingerY,
      tlPageY,
      tlScrollY,
      tlHeight,
      sheetTopY,
      durationMin,
      tlDaysLeftX,
      tlDayWidth,
      tlNumDays,
      tlSlotPad,
      previewActive,
      previewMinutes,
      previewDuration,
      previewDayIndex,
    } = schedule;
    const dayW = tlDayWidth.value;
    if (dayW <= 0) return { opacity: 0 };
    const pad = tlSlotPad.value;
    const slotWidth = dayW - pad * 2;

    // Reposition preview takes priority — its target comes from block movement.
    if (previewActive.value === 1) {
      return {
        opacity: 1,
        top: previewMinutes.value * PIXELS_PER_MINUTE,
        left: previewDayIndex.value * dayW + pad,
        width: slotWidth,
        height: Math.max(previewDuration.value * PIXELS_PER_MINUTE, 22),
      };
    }

    const col = Math.max(
      0,
      Math.min(tlNumDays.value - 1, Math.floor((fingerX.value - tlDaysLeftX.value) / dayW))
    );
    const contentY = fingerY.value - tlPageY.value + tlScrollY.value;
    const raw = contentY / PIXELS_PER_MINUTE;
    const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
    const minutes = Math.max(0, Math.min(DAY_END_MINUTES - durationMin.value, snapped));
    const floor = Math.min(tlPageY.value + tlHeight.value, sheetTopY.value);
    const inRange =
      dragActive.value === 1 && fingerY.value >= tlPageY.value && fingerY.value <= floor;
    return {
      opacity: inRange ? 1 : 0,
      top: minutes * PIXELS_PER_MINUTE,
      left: col * dayW + pad,
      width: slotWidth,
      height: Math.max(durationMin.value * PIXELS_PER_MINUTE, 22),
    };
  });

  const screenBorderColor =
    colorScheme === 'dark' ? colors.dark.screenBorder : colors.light.screenBorder;

  return (
    <View className="flex-1">
      {/* Day headers */}
      <View className="flex-row pb-2">
        <View style={{ width: THREE_DAY_TIME_COLUMN_WIDTH }} />
        {days.map((day, i) => {
          const today = i === todayIndex;
          return (
            <View key={day.toISOString()} className="flex-1 items-center">
              <Typography
                variant="tiny-10"
                color="secondary"
                style={today ? { color: colors.primary } : undefined}>
                {day.toLocaleDateString(i18n.language, { weekday: 'short' })}
              </Typography>
              <View
                className="mt-0.5 items-center justify-center"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: today ? colors.primary : 'transparent',
                }}>
                <Typography variant="subtitle-14-semibold" color={today ? 'white' : 'primary'}>
                  {day.getDate()}
                </Typography>
              </View>
            </View>
          );
        })}
      </View>

      <View className="flex-1" ref={rootRef} onLayout={measureViewport}>
        <AnimatedScrollView
          ref={scrollViewRef as any}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          scrollEnabled={editingTodoId == null}>
          <View className="flex-row" style={{ minHeight: TOTAL_HOURS * HOUR_HEIGHT }}>
            {/* While a block is armed, a tap on any empty area exits editing.
                First child, so blocks (later siblings) win touches over it. */}
            {editingTodoId != null && (
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingTodoId(null)} />
            )}
            {/* Time labels gutter */}
            <View style={{ width: THREE_DAY_TIME_COLUMN_WIDTH, paddingRight: 6 }}>
              {hourSlots.map((hour) => (
                <View
                  key={hour}
                  style={{
                    height: HOUR_HEIGHT,
                    justifyContent: 'flex-start',
                    alignItems: 'flex-end',
                  }}>
                  <Typography
                    variant="tiny-10"
                    color="secondary"
                    style={{ lineHeight: 12, marginTop: -6 }}>
                    {formatHourShort(hour)}
                  </Typography>
                </View>
              ))}
            </View>

            {/* Day columns */}
            <View
              className="flex-1"
              style={{ minHeight: TOTAL_HOURS * HOUR_HEIGHT, position: 'relative' }}
              onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}>
              {/* Hour grid lines */}
              {hourSlots.map((hour, hourIndex) => (
                <View
                  key={`grid-${hour}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: hourIndex * HOUR_HEIGHT,
                    height: 1,
                    backgroundColor: screenBorderColor,
                    opacity: 0.5,
                  }}
                />
              ))}

              {/* Vertical column separators */}
              {contentWidth > 0 &&
                Array.from({ length: THREE_DAY_COUNT }, (_, i) => (
                  <View
                    key={`col-${i}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: i * colWidth,
                      width: 1,
                      backgroundColor: screenBorderColor,
                      opacity: 0.6,
                    }}
                  />
                ))}

              {/* Drop indicator for drag-to-schedule */}
              {schedule && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    {
                      position: 'absolute',
                      borderRadius: 8,
                      borderWidth: 1.5,
                      borderColor: colors.primary,
                      borderStyle: 'dotted',
                      backgroundColor: `${colors.primary}24`,
                      zIndex: 30,
                    },
                    indicatorStyle,
                  ]}
                />
              )}

              {/* Current time indicator (today's column only) */}
              {showCurrentTimeIndicator && contentWidth > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    left: todayIndex * colWidth - 3,
                    width: colWidth + 3,
                    top: currentTimePosition - 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    zIndex: 10,
                  }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      backgroundColor: colors.primary,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor:
                        colorScheme === 'dark' ? colors.dark.screen : colors.light.screen,
                    }}
                  />
                  <View
                    style={{
                      flex: 1,
                      height: 2,
                      backgroundColor: colors.primary,
                      marginLeft: -1,
                    }}
                  />
                </View>
              )}

              {/* Scheduled TODO blocks */}
              {contentWidth > 0 &&
                todosByDay.map(({ todos: dayTodos, layout }, dayIdx) =>
                  dayTodos.map((todo) => {
                    if (!todo.startAt) return null;
                    const { colIndex, numCols } = layout.get(todo.id) ?? {
                      colIndex: 0,
                      numCols: 1,
                    };
                    const slotWidth = colWidth - THREE_DAY_BLOCK_H_PADDING * 2;
                    const blockWidth =
                      numCols <= 1 ? slotWidth : (slotWidth - BLOCK_GAP * (numCols - 1)) / numCols;
                    const left =
                      dayIdx * colWidth +
                      THREE_DAY_BLOCK_H_PADDING +
                      colIndex * (blockWidth + BLOCK_GAP);
                    return (
                      <ScheduledTodoBlock
                        key={todo.id}
                        todo={todo}
                        schedule={schedule}
                        dayIndex={dayIdx}
                        dense
                        selected={editingTodoId === todo.id}
                        onSelectedChange={(sel) => setEditingTodoId(sel ? todo.id : null)}
                        onPress={() => {
                          // While another block is armed, a tap here counts as
                          // "outside": exit editing instead of opening the editor.
                          if (editingTodoId && editingTodoId !== todo.id) {
                            setEditingTodoId(null);
                            return;
                          }
                          onTodoPress?.(todo);
                        }}
                        onReschedule={(minutes, durationMinutes) =>
                          onTodoReschedule?.(todo.id, minutes, days[dayIdx], durationMinutes)
                        }
                        style={{
                          top: getTopPosition(new Date(todo.startAt)),
                          left,
                          width: blockWidth,
                        }}
                      />
                    );
                  })
                )}
            </View>
          </View>
        </AnimatedScrollView>
      </View>
    </View>
  );
};
