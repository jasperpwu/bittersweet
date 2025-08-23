import { FC } from 'react';
import { View, ScrollView } from 'react-native';
import { Typography } from '../../ui/Typography';
import { SwipeableSessionItem } from '../SwipeableSessionItem';
import { FocusSession } from '../../../store/slices/focusSlice';

interface HistoryViewProps {
  sessionsByDate: Record<string, FocusSession[]>;
  onDeleteSession: (sessionId: string) => void;
}

const formatDateHeader = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  // Check if it's today
  if (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  ) {
    return `Today, ${date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`;
  }
  
  // Check if it's yesterday
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday, ${date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`;
  }
  
  // Format as "Monday, 20 Nov"
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  });
};

export const HistoryView: FC<HistoryViewProps> = ({
  sessionsByDate,
  onDeleteSession
}) => {
  // Sort dates in descending order (most recent first)
  const sortedDates = Object.keys(sessionsByDate).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  if (sortedDates.length === 0) {
    return (
      <View className="flex-1 px-4 pt-8">
        <View className="bg-dark-bg border border-dark-border rounded-xl p-6 items-center">
          <Typography variant="subtitle-16" color="white" className="mb-2">
            No Focus Sessions Yet
          </Typography>
          <Typography variant="body-14" color="secondary" className="text-center">
            Your focus session history will appear here.{'\n'}Complete your first session to get started!
          </Typography>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      {sortedDates.map((dateStr) => {
        const sessions = sessionsByDate[dateStr];
        const sortedSessions = sessions.sort((a, b) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );

        return (
          <View key={dateStr} className="px-4 mb-6">
            {/* Date header */}
            <Typography 
              variant="subtitle-16" 
              color="white" 
              className="mb-4"
            >
              {formatDateHeader(dateStr)}
            </Typography>

            {/* Sessions for this date */}
            <View className="space-y-3">
              {sortedSessions.map((session) => (
                <View key={session.id} className="mb-3">
                  <SwipeableSessionItem
                    session={session}
                    onDelete={onDeleteSession}
                    variant="detailed"
                  />
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};