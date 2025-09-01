import { FC } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Typography } from '../../ui/Typography';
import { FocusSessionsChart } from '../FocusSessionsChart';
import { SessionItem } from '../SessionItem';
import { ChartDataPoint, FocusSession, TimePeriod } from '../../../store/types';

interface StatisticsViewProps {
  chartData: ChartDataPoint[];
  recentSessions: FocusSession[];
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  onViewAllPress: () => void;
}

const formatDate = (date: Date): string => {
  const today = new Date();
  const sessionDate = new Date(date);
  
  // Check if it's today
  if (
    sessionDate.getDate() === today.getDate() &&
    sessionDate.getMonth() === today.getMonth() &&
    sessionDate.getFullYear() === today.getFullYear()
  ) {
    return 'Today';
  }
  
  // Check if it's yesterday
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  
  if (
    sessionDate.getDate() === yesterday.getDate() &&
    sessionDate.getMonth() === yesterday.getMonth() &&
    sessionDate.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }
  
  // Format as "Today, 22 Nov" style
  return sessionDate.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  });
};

export const StatisticsView: FC<StatisticsViewProps> = ({
  chartData,
  recentSessions,
  period,
  onPeriodChange,
  onViewAllPress
}) => {
  // Get today's date for the section header
  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  });

  return (
    <ScrollView 
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 20 }}
    >
      {/* Focus Sessions Chart */}
      <FocusSessionsChart
        data={chartData}
        period={period}
        onPeriodChange={onPeriodChange}
      />

    </ScrollView>
  );
};