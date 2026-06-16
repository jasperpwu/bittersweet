import { FC, useMemo, useRef, useEffect, useState } from 'react';
import { View, ScrollView, useColorScheme, ViewStyle } from 'react-native';
import { Typography } from '../../ui/Typography';
import { SessionBlock } from '../SessionBlock';
import { FocusSession } from '../../../types/models';

interface TimelineProps {
  sessions: FocusSession[];
  currentTime: Date;
  isToday?: boolean;
  onSessionPress: (sessionId: string) => void;
  scrollToSessionId?: string | null;
  onScrollComplete?: () => void;
}

const TIME_COLUMN_WIDTH = 70;

// Timeline configuration - showing full day
const START_HOUR = 0; // 12:00 AM
const END_HOUR = 23; // 11:00 PM
const TOTAL_HOURS = END_HOUR - START_HOUR + 1;
const HOUR_HEIGHT = 80;
const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;

// Horizontal layout for session blocks. Sessions that overlap in time are
// split into side-by-side columns within the content area.
const BLOCK_H_PADDING = 12; // gutter on each side of the content area
const BLOCK_GAP = 4; // horizontal gap between stacked columns

/**
 * Calendar-style overlap layout. Sorted sessions are grouped into clusters of
 * transitively-overlapping events; within a cluster each event is greedily
 * placed into the first column whose previous event has already ended. Every
 * event in a cluster is sized to 1/numCols of the width so nothing overlaps.
 *
 * Returns a map of session id → { colIndex, numCols }.
 */
const computeOverlapColumns = (sessions: FocusSession[]) => {
  const layout = new Map<string, { colIndex: number; numCols: number }>();
  let columns: FocusSession[][] = [];
  let groupEnd = 0;

  const flushGroup = () => {
    const numCols = columns.length;
    columns.forEach((col, colIndex) => {
      col.forEach((ev) => layout.set(ev.id, { colIndex, numCols }));
    });
    columns = [];
    groupEnd = 0;
  };

  for (const session of sessions) {
    const start = session.startTime.getTime();
    const end = session.endTime.getTime();

    // A new event starting at/after the whole group's end closes the group.
    if (columns.length > 0 && start >= groupEnd) {
      flushGroup();
    }

    // Place into the first column whose last event has already ended.
    let placed = false;
    for (const col of columns) {
      if (start >= col[col.length - 1].endTime.getTime()) {
        col.push(session);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([session]);

    groupEnd = Math.max(groupEnd, end);
  }
  flushGroup();

  return layout;
};

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
  currentTime,
  isToday: isTodayView = true,
  onSessionPress,
  scrollToSessionId,
  onScrollComplete,
}) => {
  const colorScheme = useColorScheme();
  const scrollViewRef = useRef<ScrollView>(null);
  // Measured width of the timeline content area, used to size overlap columns.
  const [contentWidth, setContentWidth] = useState(0);
  // Filter sessions for the visible time range and sort by start time
  const sortedSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [sessions]);

  // Side-by-side column assignment for overlapping sessions.
  const overlapLayout = useMemo(
    () => computeOverlapColumns(sortedSessions),
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
    <View className="flex-1">
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="flex-row" style={{ minHeight: TOTAL_HOURS * HOUR_HEIGHT }}>
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
                  backgroundColor: '#575757',
                  opacity: 0.2,
                }}
              />
            ))}

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
                    backgroundColor: '#6592E9',
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: colorScheme === 'dark' ? '#1B1C30' : '#F5E6D3',
                  }}
                />
                {/* Blue line */}
                <View 
                  style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: '#6592E9',
                    marginLeft: -1,
                  }}
                />
              </View>
            )}

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
      </ScrollView>
    </View>
  );
};