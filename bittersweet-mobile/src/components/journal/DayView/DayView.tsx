import React, { FC, useMemo } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';
import { TimeEntry } from '../TimeEntry';
import { FocusSession } from '../../../types/models';

interface DayViewProps {
  selectedDate: Date;
  sessions: FocusSession[];
  onSessionEdit?: (session: FocusSession) => void;
  onSessionDelete?: (sessionId: string) => void;
  onTimeSlotPress?: (hour: number) => void;
  onViewModeChange?: (mode: 'day' | 'week' | 'month') => void;
  onDateChange?: (date: Date) => void;
}

export const DayView: FC<DayViewProps> = ({
  selectedDate,
  sessions,
  onSessionEdit,
  onSessionDelete,
  onTimeSlotPress,
  onViewModeChange,
  onDateChange,
}) => {
  // Generate hourly time slots for the day (6 AM to 11 PM)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 6; hour <= 23; hour++) {
      slots.push({
        hour,
        time: `${hour.toString().padStart(2, '0')}:00`,
        displayTime: hour === 12 ? '12:00 PM' : 
                    hour > 12 ? `${(hour - 12).toString().padStart(2, '0')}:00 PM` : 
                    `${hour.toString().padStart(2, '0')}:00 AM`,
      });
    }
    return slots;
  }, []);

  // Filter sessions for the selected date and convert to TimeEntry format
  const daySessionEntries = useMemo(() => {
    return sessions
      .filter(session => {
        const sessionDate = new Date(session.startTime);
        return sessionDate.toDateString() === selectedDate.toDateString();
      })
      .map(session => ({
        id: session.id,
        startTime: new Date(session.startTime),
        endTime: new Date(session.endTime),
        duration: session.duration,
        category: session.tagName || 'Focus',
        tags: [session.tagName || 'Focus'],
        description: session.notes,
        isManualEntry: true, // All journal entries are manual for now
      }))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [sessions, selectedDate]);

  // Get sessions for a specific hour
  const getSessionsForHour = (hour: number) => {
    return daySessionEntries.filter(session => {
      const sessionHour = session.startTime.getHours();
      const sessionEndHour = session.endTime.getHours();
      return sessionHour === hour || (sessionHour < hour && sessionEndHour > hour);
    });
  };

  const formatDateHeader = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toDateString() === date.toDateString();
    const isTomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toDateString() === date.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    if (isTomorrow) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const navigateToPrevDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    onDateChange?.(prevDay);
  };

  const navigateToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    onDateChange?.(nextDay);
  };

  return (
    <View className="flex-1 bg-dark-bg">
      {/* Day Header */}
      <View className="px-4 py-3 border-b border-dark-border">
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center">
            <Pressable 
              onPress={navigateToPrevDay}
              className="p-2 active:opacity-60"
            >
              <Typography variant="body-14" color="primary">‹</Typography>
            </Pressable>
            <View className="mx-3">
              <Typography variant="headline-18" color="white" className="font-semibold">
                {formatDateHeader(selectedDate)}
              </Typography>
            </View>
            <Pressable 
              onPress={navigateToNextDay}
              className="p-2 active:opacity-60"
            >
              <Typography variant="body-14" color="primary">›</Typography>
            </Pressable>
          </View>
          
          {/* View Mode Selector */}
          {onViewModeChange && (
            <View className="flex-row space-x-2">
              {(['day', 'week', 'month'] as const).map((mode) => (
                <Pressable
                  key={mode}
                  onPress={() => onViewModeChange(mode)}
                  className={`px-3 py-1 rounded-full ${mode === 'day' ? 'bg-primary' : 'bg-dark-bg'}`}
                >
                  <Typography 
                    variant="body-12" 
                    color={mode === 'day' ? 'white' : 'primary'}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Typography>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <Typography variant="body-12" color="secondary">
          {selectedDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </Typography>
      </View>

      {/* Hourly Timeline */}
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {timeSlots.map(({ hour, displayTime }) => {
          const hourSessions = getSessionsForHour(hour);
          const isEmpty = hourSessions.length === 0;

          return (
            <View key={hour} className="flex-row">
              {/* Time Column */}
              <View className="w-16 py-4 px-2 border-r border-dark-border">
                <Typography variant="body-12" color="secondary" className="text-right">
                  {displayTime.replace(' AM', '').replace(' PM', '')}
                </Typography>
                <Typography variant="tiny-10" color="secondary" className="text-right">
                  {hour < 12 ? 'AM' : 'PM'}
                </Typography>
              </View>

              {/* Content Column */}
              <View className="flex-1 min-h-[60px] border-b border-dark-border/30">
                {isEmpty ? (
                  <Pressable 
                    className="flex-1 py-4 px-4 active:bg-dark-border/20"
                    onPress={() => onTimeSlotPress?.(hour)}
                  >
                    <Typography variant="body-12" color="secondary" className="opacity-40">
                      No sessions
                    </Typography>
                  </Pressable>
                ) : (
                  <View className="py-2">
                    {hourSessions.map((session) => (
                      <View key={session.id} className="mb-2">
                        <TimeEntry
                          entry={session}
                          onEdit={onSessionEdit ? () => onSessionEdit({
                            id: session.id,
                            startTime: session.startTime,
                            endTime: session.endTime,
                            duration: session.duration,
                            tagName: session.tagName,
                            notes: session.description,
                          }) : undefined}
                          onDelete={onSessionDelete}
                          showActions={!!(onSessionEdit || onSessionDelete)}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Summary Footer */}
      {daySessionEntries.length > 0 && (
        <View className="px-4 py-3 border-t border-dark-border bg-dark-bg">
          <View className="flex-row justify-between">
            <Typography variant="body-12" color="secondary">
              {daySessionEntries.length} session{daySessionEntries.length !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body-12" color="primary">
              {Math.round(daySessionEntries.reduce((total, session) => total + session.duration, 0))} min total
            </Typography>
          </View>
        </View>
      )}
    </View>
  );
};