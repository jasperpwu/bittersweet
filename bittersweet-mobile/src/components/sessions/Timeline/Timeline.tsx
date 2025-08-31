import { FC, useMemo } from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { Typography } from '../../ui/Typography/Typography';
import { TaskBlock } from '../TaskBlock';
import { EmptyState } from '../EmptyState';
import { FocusSession } from '../../../types/models';

interface TimelineProps {
  sessions: FocusSession[];
  currentTime: Date;
  onSessionPress: (sessionId: string) => void;
  onAddSession?: () => void;
}

const TIME_COLUMN_WIDTH = 70;

// Timeline configuration
const START_HOUR = 8; // 8:00 AM
const END_HOUR = 15; // 3:00 PM
const TOTAL_HOURS = END_HOUR - START_HOUR;
const HOUR_HEIGHT = 80;
const PIXELS_PER_MINUTE = HOUR_HEIGHT / 60;

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
  onSessionPress,
  onAddSession,
}) => {
  // Filter sessions for the selected date and sort by start time
  const sortedSessions = useMemo(() => {
    return sessions
      .filter(session => {
        const sessionHour = session.startTime.getHours();
        return sessionHour >= START_HOUR && sessionHour <= END_HOUR;
      })
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [sessions]);

  // Show empty state if no sessions
  if (sessions.length === 0) {
    return <EmptyState onAddSession={onAddSession} />;
  }

  // Generate hour slots
  const hourSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
      slots.push(hour);
    }
    return slots;
  }, []);

  // Check if current time indicator should be shown
  const showCurrentTimeIndicator = isCurrentTimeInRange(currentTime);
  const currentTimePosition = showCurrentTimeIndicator ? getCurrentTimePosition(currentTime) : 0;

  return (
    <View className="flex-1">
      <ScrollView
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
                  paddingTop: 8,
                }}
              >
                <Typography
                  variant="body-12"
                  className="text-dark-text-secondary"
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
                    borderColor: '#1B1C30',
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
              
              return (
                <TaskBlock
                  key={session.id}
                  session={session}
                  onPress={() => onSessionPress(session.id)}
                  timeSlotHeight={HOUR_HEIGHT}
                  pixelsPerMinute={PIXELS_PER_MINUTE}
                  style={{
                    position: 'absolute',
                    top: topPosition,
                    left: 12,
                    right: 12,
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