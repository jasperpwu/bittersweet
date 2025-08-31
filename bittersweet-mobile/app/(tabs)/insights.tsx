import { useState, useMemo } from 'react';
import { View, SafeAreaView, Pressable } from 'react-native';
import { Typography } from '../../src/components/ui/Typography';
import { StatisticsView } from '../../src/components/analytics/StatisticsView';
import { HistoryView } from '../../src/components/analytics/HistoryView';
import { useFocus, useFocusSelectors } from '../../src/store';
import { TimePeriod } from '../../src/store/types';

type ViewMode = 'statistics' | 'history';

export default function InsightsScreen() {
  const [currentView, setCurrentView] = useState<ViewMode>('statistics');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly');

  // Get data from focus store
  const { sessions } = useFocus();
  const selectors = useFocusSelectors();
  
  // Placeholder functions until focus slice is fully implemented
  const getSessionsByDate = () => ({});
  const deleteSession = (sessionId: string) => {
    console.log('Deleting session:', sessionId);
  };
  
  // Simple chart data placeholder
  const getChartData = (period: TimePeriod) => {
    // Return empty array for now - this would normally process session data
    return [];
  };

  // Memoized data processing
  const chartData = useMemo(() => getChartData(selectedPeriod), [selectedPeriod, sessions]);
  const sessionsByDate = useMemo(() => getSessionsByDate(), [sessions]);
  
  // Get today's sessions for statistics view
  const todaysSessions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return (sessionsByDate as Record<string, any>)[today] || [];
  }, [sessionsByDate]);

  const handlePeriodChange = (period: TimePeriod) => {
    setSelectedPeriod(period);
  };

  const handleViewAllPress = () => {
    setCurrentView('history');
  };

  const handleBackPress = () => {
    setCurrentView('statistics');
  };

  const handleDeleteSession = (sessionId: string) => {
    deleteSession(sessionId);
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-bg">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          {currentView === 'history' && (
            <Pressable 
              onPress={handleBackPress}
              className="mr-3 p-1 active:opacity-70"
            >
              <Typography variant="headline-18" color="white">
                ←
              </Typography>
            </Pressable>
          )}
          <Typography variant="headline-18" color="white">
            {currentView === 'statistics' ? 'Statistics' : 'History'}
          </Typography>
        </View>
        
        {/* Settings icon placeholder */}
        <Pressable className="p-2 active:opacity-70">
          <Typography variant="headline-18" color="secondary">
            ⚙️
          </Typography>
        </Pressable>
      </View>

      {/* Content */}
      {currentView === 'statistics' ? (
        <StatisticsView
          chartData={chartData}
          recentSessions={todaysSessions}
          period={selectedPeriod}
          onPeriodChange={handlePeriodChange}
          onViewAllPress={handleViewAllPress}
        />
      ) : (
        <HistoryView
          sessionsByDate={sessionsByDate}
          onDeleteSession={handleDeleteSession}
        />
      )}
    </SafeAreaView>
  );
}