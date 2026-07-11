import { FC, useMemo, useRef, useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, useColorScheme, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Typography } from '../../ui/Typography';
import { SessionBlock, ScheduledTodoBlock } from '../SessionBlock';
import { FocusSession } from '../../../types/models';
import type { Todo } from '../../../store/types';
import type { TodoScheduleController } from '../TodoSheet/TodoScheduleController';
import { colors } from '../../../config/theme';
import {
  TIME_COLUMN_WIDTH,
  START_HOUR,
  END_HOUR,
  TOTAL_HOURS,
  HOUR_HEIGHT,
  PIXELS_PER_MINUTE,
  SNAP_MINUTES,
  BLOCK_H_PADDING,
} from './constants';
import { computeOverlapColumns } from './overlapColumns';

interface TimelineProps {
  sessions: FocusSession[];
  scheduledTodos?: Todo[];
  currentTime: Date;
  isToday?: boolean;
  onSessionPress: (sessionId: string) => void;
  onTodoPress?: (todo: Todo) => void;
  onTodoReschedule?: (todoId: string, minutes: number, durationMinutes?: number) => void;
  schedule?: TodoScheduleController;
  scrollToSessionId?: string | null;
  onScrollComplete?: () => void;
}

// Horizontal gap between stacked columns when sessions overlap in time.
const BLOCK_GAP = 4;
const DAY_END_MINUTES = (END_HOUR + 1) * 60;

const AnimatedScrollView = Animated.ScrollView;

const formatHour = (hour: number) => {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${period}`;
};

const getMinutesFromStartOfDay = (date: Date) => {
  return date.getHours() * 60 + date.getMinutes();
};

const getTopPosition = (startTime: Date) => {
  const startMinutes = getMinutesFromStartOfDay(startTime);
  const timelineStartMinutes = START_HOUR * 60;
  const minutesFromTimelineStart = startMinutes - timelineStartMinutes;
  return Math.max(0, minutesFromTimelineStart * PIXELS_PER_MINUTE);
};

const isCurrentTimeInRange = (currentTime: Date) => {
  const currentHour = currentTime.getHours();
  return currentHour >= START_HOUR && currentHour <= END_HOUR;
};

const getCurrentTimePosition = (currentTime: Date) => {
  const currentMinutes = getMinutesFromStartOfDay(currentTime);
  const timelineStartMinutes = START_HOUR * 60;
  const minutesFromTimelineStart = currentMinutes - timelineStartMinutes;
  return minutesFromTimelineStart * PIXELS_PER_MINUTE;
};

export const Timeline: FC<TimelineProps> = ({
  sessions,
  scheduledTodos = [],
  currentTime,
  isToday: isTodayView = true,
  onSessionPress,
  onTodoPress,
  onTodoReschedule,
  schedule,
  scrollToSessionId,
  onScrollComplete,
}) => {
  const colorScheme = useColorScheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const rootRef = useRef<View>(null);
  // Measured width of the timeline content area, used to size overlap columns.
  const [contentWidth, setContentWidth] = useState(0);
  // Todo block armed for move/resize (long-pressed). Owned here so only one is
  // editable at a time and scrolling pauses while its pan gestures are active.
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  useEffect(() => {
    if (editingTodoId && !scheduledTodos.some((td) => td.id === editingTodoId)) {
      setEditingTodoId(null);
    }
  }, [editingTodoId, scheduledTodos]);
  // Filter sessions for the visible time range and sort by start time
  const sortedSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [sessions]);

  // Side-by-side column assignment for overlapping sessions.
  const overlapLayout = useMemo(
    () =>
      computeOverlapColumns(
        sortedSessions.map((s) => ({
          id: s.id,
          start: s.startTime.getTime(),
          end: s.endTime.getTime(),
        }))
      ),
    [sortedSessions]
  );

  // Generate hour slots
  const hourSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      slots.push(hour);
    }
    return slots;
  }, []);

  // Check if current time indicator should be shown (only on today)
  const showCurrentTimeIndicator = isTodayView && isCurrentTimeInRange(currentTime);
  const currentTimePosition = showCurrentTimeIndicator ? getCurrentTimePosition(currentTime) : 0;

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

  // Report the scroll viewport's screen position + height so the sheet's drag
  // gesture can map a finger Y to a minute-of-day.
  const measureViewport = () => {
    if (!schedule) return;
    rootRef.current?.measureInWindow((x, y, w, h) => {
      schedule.tlPageY.value = y;
      schedule.tlHeight.value = h;
      // Single full-width day column: the drag ghost + drop math derive a
      // block's left/width from this the same way the 3-day view does.
      schedule.tlDaysLeftX.value = x + TIME_COLUMN_WIDTH;
      schedule.tlDayWidth.value = Math.max(0, w - TIME_COLUMN_WIDTH);
      schedule.tlNumDays.value = 1;
      schedule.tlSlotPad.value = BLOCK_H_PADDING;
    });
  };

  // Live drop indicator: a dotted slot outline shown both when dragging a todo
  // in from the sheet (finger-mapped) and when repositioning an existing block
  // within the calendar (explicit preview values set by the block).
  const indicatorStyle = useAnimatedStyle(() => {
    if (!schedule) return { opacity: 0 };
    const {
      dragActive, fingerY, tlPageY, tlScrollY, tlHeight, sheetTopY, durationMin,
      previewActive, previewMinutes, previewDuration,
    } = schedule;

    // Reposition preview takes priority — its target comes from block movement.
    if (previewActive.value === 1) {
      return {
        opacity: 1,
        top: previewMinutes.value * PIXELS_PER_MINUTE,
        height: Math.max(previewDuration.value * PIXELS_PER_MINUTE, 22),
      };
    }

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
      height: Math.max(durationMin.value * PIXELS_PER_MINUTE, 22),
    };
  });

  // Handle scrolling to specific session
  useEffect(() => {
    if (scrollToSessionId && scrollViewRef.current) {
      const targetSession = sortedSessions.find(session => session.id === scrollToSessionId);
      if (targetSession) {
        const scrollPosition = getTopPosition(targetSession.startTime);
        // Offset to center the session in view (accounting for some padding)
        const offsetScrollPosition = Math.max(0, scrollPosition - 200);

        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: offsetScrollPosition,
            animated: true,
          });
          onScrollComplete?.();
        }, 300); // Small delay to ensure the component is fully rendered
      }
    }
  }, [scrollToSessionId, sortedSessions, onScrollComplete]);

  return (
    <View className="flex-1" ref={rootRef} onLayout={measureViewport}>
      <AnimatedScrollView
        ref={scrollViewRef as any}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        scrollEnabled={editingTodoId == null}
      >
        <View className="flex-row" style={{ minHeight: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* While a block is armed, a tap on any empty area exits editing.
              First child, so blocks (later siblings) win touches over it. */}
          {editingTodoId != null && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setEditingTodoId(null)}
            />
          )}
          {/* Time labels column */}
          <View
            style={{
              width: TIME_COLUMN_WIDTH,
              paddingRight: 12,
            }}
          >
            {hourSlots.map((hour, index) => (
              <View
                key={hour}
                style={{
                  height: HOUR_HEIGHT,
                  justifyContent: 'flex-start',
                  alignItems: 'flex-end',
                }}
              >
                <Typography
                  variant="body-12"
                  color="secondary"
                  style={{ lineHeight: 14, marginTop: -7 }}
                >
                  {formatHour(hour)}
                </Typography>
              </View>
            ))}
          </View>

          {/* Timeline content */}
          <View
            className="flex-1"
            style={{
              minHeight: TOTAL_HOURS * HOUR_HEIGHT,
              position: 'relative',
            }}
            onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
          >
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
                  backgroundColor: colors.dark.border,
                  opacity: 0.2,
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
                    left: BLOCK_H_PADDING,
                    right: BLOCK_H_PADDING,
                    borderRadius: 12,
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

            {/* Current time indicator */}
            {showCurrentTimeIndicator && (
              <View
                style={{
                  position: 'absolute',
                  left: -6,
                  right: 0,
                  top: currentTimePosition - 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  zIndex: 10,
                }}
              >
                {/* Blue dot */}
                <View
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: colors.primary,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: colorScheme === 'dark' ? colors.dark.background : colors.light.screen,
                  }}
                />
                {/* Blue line */}
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

            {/* Scheduled (planned) TODO blocks — drawn under real sessions */}
            {scheduledTodos.map((todo) => {
              if (!todo.startAt) return null;
              return (
                <ScheduledTodoBlock
                  key={todo.id}
                  todo={todo}
                  schedule={schedule}
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
                    onTodoReschedule?.(todo.id, minutes, durationMinutes)
                  }
                  style={{
                    top: getTopPosition(new Date(todo.startAt)),
                    left: BLOCK_H_PADDING,
                    right: BLOCK_H_PADDING,
                  }}
                />
              );
            })}

            {/* Session blocks */}
            {sortedSessions.map((session) => {
              const topPosition = getTopPosition(session.startTime);
              const { colIndex, numCols } = overlapLayout.get(session.id) ?? {
                colIndex: 0,
                numCols: 1,
              };

              // Single-column (no overlap) or pre-measurement: full width.
              // Once measured and overlapping, split into side-by-side columns.
              let horizontalStyle: ViewStyle;
              if (numCols <= 1 || contentWidth === 0) {
                horizontalStyle = { left: BLOCK_H_PADDING, right: BLOCK_H_PADDING };
              } else {
                const available = contentWidth - BLOCK_H_PADDING * 2;
                const colWidth = (available - BLOCK_GAP * (numCols - 1)) / numCols;
                horizontalStyle = {
                  left: BLOCK_H_PADDING + colIndex * (colWidth + BLOCK_GAP),
                  width: colWidth,
                };
              }

              return (
                <SessionBlock
                  key={session.id}
                  session={session}
                  onPress={() => onSessionPress(session.id)}
                  timeSlotHeight={HOUR_HEIGHT}
                  pixelsPerMinute={PIXELS_PER_MINUTE}
                  style={{
                    position: 'absolute',
                    top: topPosition,
                    ...horizontalStyle,
                  }}
                />
              );
            })}
          </View>
        </View>
      </AnimatedScrollView>
    </View>
  );
};
