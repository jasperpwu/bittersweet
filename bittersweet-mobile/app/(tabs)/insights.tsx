import { useState, useMemo } from 'react';
import { View, SafeAreaView, Pressable } from 'react-native';
import { Typography } from '../../src/components/ui/Typography';
import { StatisticsView } from '../../src/components/analytics/StatisticsView';
import { HistoryView } from '../../src/components/analytics/HistoryView';
import { GoalProgress } from '../../src/components/analytics/GoalProgress';
import { GoalConfigModal } from '../../src/components/modals/GoalConfigModal';
import { useFocus, useFocusActions } from '../../src/store';
import { TimePeriod, FocusGoal } from '../../src/store/types';
import { calculateGoalProgress, getActiveGoals } from '../../src/utils/goalProgress';

type ViewMode = 'statistics' | 'history';

export default function InsightsScreen() {
  const [currentView, setCurrentView] = useState<ViewMode>('statistics');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly');
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Get data from focus store
  const { sessions, tags } = useFocus();
  const { getActiveGoals } = useFocusActions();
  
  // Extract sessions array from normalized state
  const safeSessions = sessions ? sessions.allIds.map(id => sessions.byId[id]).filter(Boolean) : [];

  // Get goals from store
  const storeGoals = getActiveGoals();
  
  // Create tag map for goal progress calculation
  const tagMap = useMemo(() => 
    tags.allIds.reduce((map, id) => {
      const tag = tags.byId[id];
      if (tag) {
        map[id] = { id: tag.id, name: tag.name };
      }
      return map;
    }, {} as Record<string, { id: string; name: string }>),
    [tags]
  );
  
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
  const chartData = useMemo(() => getChartData(selectedPeriod), [selectedPeriod, safeSessions]);
  const sessionsByDate = useMemo(() => getSessionsByDate(), [safeSessions]);
  
  // Calculate goal progress
  const goalProgress = useMemo(() => 
    calculateGoalProgress(storeGoals, safeSessions, tagMap), 
    [storeGoals, safeSessions, tagMap]
  );
  
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
        
        {/* Settings icon */}
        <Pressable 
          onPress={() => setShowGoalModal(true)}
          className="p-2 active:opacity-70"
        >
          <Typography variant="headline-18" color="secondary">
            ⚙️
          </Typography>
        </Pressable>
      </View>

      {/* Content */}
      {currentView === 'statistics' ? (
        <View className="flex-1">
          {/* Goal Progress Section */}
          <GoalProgress 
            goals={storeGoals}
            currentPeriodProgress={goalProgress}
          />
          
          {/* Statistics View */}
          <StatisticsView
            chartData={chartData}
            recentSessions={todaysSessions}
            period={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            onViewAllPress={handleViewAllPress}
          />
        </View>
      ) : (
        <HistoryView
          sessionsByDate={sessionsByDate}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {/* Goal Configuration Modal */}
      <GoalConfigModal
        isVisible={showGoalModal}
        onClose={() => setShowGoalModal(false)}
      />
    </SafeAreaView>
  );
}