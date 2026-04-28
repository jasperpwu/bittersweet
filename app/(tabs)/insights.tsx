import { useState, useMemo } from 'react';
import { View, SafeAreaView, Pressable } from 'react-native';
import { Typography } from '../../src/components/ui/Typography';
import { StatisticsView } from '../../src/components/analytics/StatisticsView';
import { GoalProgress } from '../../src/components/analytics/GoalProgress';
import { GoalConfigModal } from '../../src/components/modals/GoalConfigModal';
import { useFocus, useFocusActions } from '../../src/store';
import { TimePeriod, FocusGoal, ChartSegment } from '../../src/store/types';
import { calculateGoalProgress } from '../../src/utils/goalProgress';

type ViewMode = 'statistics' | 'history';

export default function InsightsScreen() {
  const [currentView, setCurrentView] = useState<ViewMode>('statistics');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly');
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Get data from focus store
  const { sessions, tags } = useFocus();
  const { getActiveGoals } = useFocusActions();
  
  // Extract sessions array from normalized state
  const safeSessions = (sessions && sessions.allIds && sessions.byId) 
    ? sessions.allIds.map(id => sessions.byId[id]).filter(Boolean) 
    : [];

  // Get goals from store
  const storeGoals = getActiveGoals() || [];
  
  // Create tag map for goal progress calculation
  const tagMap = useMemo(() => 
    (tags && tags.allNames && tags.byName ? tags.allNames : []).reduce((map, name) => {
      if (tags && tags.byName) {
        const tag = tags.byName[name];
        if (tag) {
          map[name] = { id: name, name: tag.name };
        }
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
  
  // Tag color mapping
  const tagColorMap: Record<string, string> = {
    'Work': '#6592E9',
    'Study': '#FFC107',
    'Reading': '#51BC6F',
    'Exercise': '#FF9800',
    'Sport': '#FF9800',
    'Meditation': '#4CAF50',
    'Code': '#EF786C',
    'IT': '#2196F3',
    'Music': '#9C27B0',
    'Personal': '#9E9E9E',
    'Focus': '#6592E9',
  };

  const getTagColor = (tagName: string): string => {
    return tagColorMap[tagName] || '#6592E9';
  };

  // Build segments from sessions in a time range
  const buildSegments = (rangeSessions: typeof safeSessions): ChartSegment[] => {
    const tagTotals: Record<string, number> = {};
    rangeSessions.forEach(session => {
      const key = (session as any).tagName || (session as any).tagId || 'Other';
      tagTotals[key] = (tagTotals[key] || 0) + session.duration;
    });
    return Object.entries(tagTotals).map(([name, value]) => ({
      tagName: name,
      value,
      color: getTagColor(name),
    }));
  };

  // Generate chart data from sessions
  const getChartData = (period: TimePeriod) => {
    if (!safeSessions || !Array.isArray(safeSessions) || !safeSessions.length) return [];

    const now = new Date();
    const chartData: Array<{ date: Date; value: number; label: string; segments: ChartSegment[] }> = [];

    if (period === 'weekly') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);

        const daySessions = safeSessions.filter(session => {
          const sessionDate = new Date(session.startTime);
          return sessionDate >= date && sessionDate < nextDay;
        });

        const totalMinutes = daySessions.reduce((total, session) => total + session.duration, 0);

        chartData.push({
          date,
          value: totalMinutes,
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          segments: buildSegments(daySessions),
        });
      }
    } else if (period === 'monthly') {
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (i * 7) - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const weekSessions = safeSessions.filter(session => {
          const sessionDate = new Date(session.startTime);
          return sessionDate >= weekStart && sessionDate < weekEnd;
        });

        const totalMinutes = weekSessions.reduce((total, session) => total + session.duration, 0);

        chartData.push({
          date: weekStart,
          value: totalMinutes,
          label: `W${Math.ceil((now.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24 * 7))}`,
          segments: buildSegments(weekSessions),
        });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const chunkStart = new Date(now);
        chunkStart.setHours(now.getHours() - (i * 4), 0, 0, 0);

        const chunkEnd = new Date(chunkStart);
        chunkEnd.setHours(chunkStart.getHours() + 4);

        const chunkSessions = safeSessions.filter(session => {
          const sessionDate = new Date(session.startTime);
          return sessionDate >= chunkStart && sessionDate < chunkEnd;
        });

        const totalMinutes = chunkSessions.reduce((total, session) => total + session.duration, 0);

        chartData.push({
          date: chunkStart,
          value: totalMinutes,
          label: `${chunkStart.getHours()}:00`,
          segments: buildSegments(chunkSessions),
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
        <View className="flex-1">Empty View</View>
      )}

      {/* Goal Configuration Modal */}
      <GoalConfigModal
        isVisible={showGoalModal}
        onClose={() => setShowGoalModal(false)}
      />
    </SafeAreaView>
  );
}