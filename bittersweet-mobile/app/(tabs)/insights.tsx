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
    (tags.allNames || []).reduce((map, name) => {
      const tag = tags.byName[name];
      if (tag) {
        map[name] = { id: name, name: tag.name };
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
  
  // Generate chart data from sessions
  const getChartData = (period: TimePeriod) => {
    if (!safeSessions.length) return [];

    const now = new Date();
    const chartData: Array<{ date: Date; value: number; label: string }> = [];

    if (period === 'weekly') {
      // Get last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);
        
        const daySessionsMinutes = safeSessions
          .filter(session => {
            const sessionDate = new Date(session.startTime);
            return sessionDate >= date && sessionDate < nextDay;
          })
          .reduce((total, session) => total + session.duration, 0);
        
        chartData.push({
          date,
          value: daySessionsMinutes,
          label: date.toLocaleDateString('en-US', { weekday: 'short' })
        });
      }
    } else if (period === 'monthly') {
      // Get last 4 weeks
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        
        const weekSessionsMinutes = safeSessions
          .filter(session => {
            const sessionDate = new Date(session.startTime);
            return sessionDate >= weekStart && sessionDate < weekEnd;
          })
          .reduce((total, session) => total + session.duration, 0);
        
        chartData.push({
          date: weekStart,
          value: weekSessionsMinutes,
          label: `W${Math.ceil((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24 * 7))}`
        });
      }
    } else {
      // Daily - last 24 hours broken into 6 4-hour chunks
      for (let i = 5; i >= 0; i--) {
        const chunkStart = new Date(now);
        chunkStart.setHours(now.getHours() - (i * 4), 0, 0, 0);
        
        const chunkEnd = new Date(chunkStart);
        chunkEnd.setHours(chunkStart.getHours() + 4);
        
        const chunkSessionsMinutes = safeSessions
          .filter(session => {
            const sessionDate = new Date(session.startTime);
            return sessionDate >= chunkStart && sessionDate < chunkEnd;
          })
          .reduce((total, session) => total + session.duration, 0);
        
        chartData.push({
          date: chunkStart,
          value: chunkSessionsMinutes,
          label: `${chunkStart.getHours()}:00`
        });
      }
    }

    return chartData;
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