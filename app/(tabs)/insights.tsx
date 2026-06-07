import { useState, useMemo, useCallback } from 'react';
import { View, SafeAreaView, Alert, ScrollView } from 'react-native';
import { Typography } from '../../src/components/ui/Typography';
import { StatisticsView } from '../../src/components/analytics/StatisticsView';
import { GoalProgress } from '../../src/components/analytics/GoalProgress';
import { BadgeCollection } from '../../src/components/analytics/BadgeCollection';
import { GoalConfigModal } from '../../src/components/modals/GoalConfigModal';
import { UpgradeSheet } from '../../src/components/subscription/UpgradeSheet';
import { UpgradePrompt } from '../../src/components/subscription/UpgradePrompt';
import { useFocus, useFocusActions, useAppStore } from '../../src/store';
import { SharedTagStats } from '../../src/components/analytics/SharedTagStats/SharedTagStats';
import { useAppSettings } from '../../src/store/unified-store';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { TimePeriod, FocusGoal, Badge, ChartSegment } from '../../src/store/types';
import { calculateGoalProgress } from '../../src/utils/goalProgress';
import { SwipeableTabWrapper } from '../../src/components/ui/SwipeableTabWrapper';

type ViewMode = 'statistics' | 'history';

export default function InsightsScreen() {
  const [currentView, setCurrentView] = useState<ViewMode>('statistics');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [activatingTagId, setActivatingTagId] = useState<string | undefined>(undefined);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showUpgradeSheet, setShowUpgradeSheet] = useState(false);
  const { canActivateGoal } = useSubscriptionGate();
  const { preferences } = useAppSettings();
  const weekStartDay = 1; // Always Monday

  // Get data from focus store
  const { sessions, tags, goals, sharedTagStats } = useFocus();
  const { deleteGoal, concludeGoal, deleteBadge, reorderGoals, fetchJoinerStats, removeJoiner } = useFocusActions();

  // Extract sessions array from normalized state
  const safeSessions = (sessions && sessions.allIds && sessions.byId)
    ? sessions.allIds.map(id => sessions.byId[id]).filter(Boolean)
    : [];

  // Get active goals preserving allIds order
  const storeGoals = useMemo(() => {
    if (!goals?.allIds || !goals?.byId) return [];
    return goals.allIds
      .map(id => goals.byId[id])
      .filter((g): g is FocusGoal => !!g && g.isActive);
  }, [goals]);

  // Get inactive goals (not active, tag not deleted)
  const inactiveGoals = useMemo(() => {
    if (!goals?.allIds || !goals?.byId) return [];
    return goals.allIds
      .map(id => goals.byId[id])
      .filter((g): g is FocusGoal => {
        if (!g || g.isActive) return false;
        const tag = tags?.byId?.[g.tagId];
        return !!tag && !tag.deletedAt;
      });
  }, [goals, tags]);

  // Tags the user is actively sharing (for SharedTagStats)
  const sharingTags = useMemo(() => {
    if (!tags?.allIds || !tags?.byId) return [];
    return tags.allIds
      .map(id => tags.byId[id])
      .filter(t => t && !t.deletedAt && t.isSharing);
  }, [tags]);

  // Get badges from store
  const badgeStore = useAppStore((state) => state.focus.badges);
  const badges = useMemo((): Badge[] => {
    if (!badgeStore?.allIds || !badgeStore?.byId) return [];
    return badgeStore.allIds.map((id: string) => badgeStore.byId[id]).filter(Boolean);
  }, [badgeStore]);

  // Create tag map for goal progress calculation
  const tagMap = useMemo(() =>
    (tags && tags.allIds && tags.byId ? tags.allIds : []).reduce((map, id) => {
      if (tags && tags.byId) {
        const tag = tags.byId[id];
        if (tag) {
          map[id] = { id: tag.id, name: tag.name };
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

  const getTagColor = (tagIdOrName: string): string => {
    const tag = tags?.byId?.[tagIdOrName];
    if (tag) return tag.color || '#6592E9';
    if (tags?.allIds) {
      for (const id of tags.allIds) {
        const t = tags.byId[id];
        if (t?.name === tagIdOrName) return t.color || '#6592E9';
      }
    }
    return '#6592E9';
  };

  // Build segments from sessions in a time range
  const buildSegments = (rangeSessions: typeof safeSessions): ChartSegment[] => {
    const tagTotals: Record<string, number> = {};
    rangeSessions.forEach(session => {
      const tagId = (session as any).tagId || 'Other';
      tagTotals[tagId] = (tagTotals[tagId] || 0) + session.duration;
    });
    return Object.entries(tagTotals).map(([id, value]) => {
      const tag = tags?.byId?.[id];
      return {
        tagName: tag?.name || id,
        value,
        color: tag?.color || getTagColor(id),
      };
    });
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
    calculateGoalProgress(storeGoals, safeSessions, tagMap, weekStartDay),
    [storeGoals, safeSessions, tagMap, weekStartDay]
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

  const handleEditGoal = useCallback((goalId: string) => {
    setEditingGoalId(goalId);
    setActivatingTagId(undefined);
    setShowGoalModal(true);
  }, []);

  const handleDeleteGoal = useCallback((goalId: string) => {
    const goal = storeGoals.find(g => g.id === goalId);
    const goalTagId = goal?.tagId || (goal as any)?.tagIds?.[0];
    const tag = goalTagId ? tags?.byId?.[goalTagId] : null;
    const goalName = goal?.customName || (tag ? `${tag.icon} ${tag.name} Goal` : 'this goal');

    Alert.alert(
      'Deactivate goal?',
      `Deactivate "${goalName}"? You can reactivate it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () => deleteGoal(goalId),
        },
      ],
      { cancelable: true }
    );
  }, [storeGoals, tags, deleteGoal]);

  const handleConcludeGoal = useCallback((goalId: string) => {
    const goal = storeGoals.find(g => g.id === goalId);
    const goalTagId = goal?.tagId || (goal as any)?.tagIds?.[0];
    const tag = goalTagId ? tags?.byId?.[goalTagId] : null;
    const goalName = goal?.customName || (tag ? `${tag.icon} ${tag.name} Goal` : 'this goal');

    const hasExistingBadge = badges.some(b => b.goalId === goalId);
    const message = hasExistingBadge
      ? `Conclude "${goalName}"? Your existing badge will be updated summarizing your performance, and the goal will be deactivated.`
      : `Conclude "${goalName}"? A badge will be created summarizing your performance, and the goal will be deactivated.`;

    Alert.alert(
      'Conclude goal?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Conclude',
          style: 'default',
          onPress: () => concludeGoal(goalId),
        },
      ],
      { cancelable: true }
    );
  }, [storeGoals, tags, badges, concludeGoal]);

  const handleActivateGoal = useCallback((goalId: string) => {
    if (!canActivateGoal) {
      setShowUpgradePrompt(true);
      return;
    }
    const goal = goals?.byId?.[goalId];
    setEditingGoalId(goalId);
    setActivatingTagId(goal?.tagId);
    setShowGoalModal(true);
  }, [canActivateGoal, goals]);

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-dark-bg">
    <SwipeableTabWrapper currentTab="insights">
      {/* Header */}
      <View className="px-4 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          {currentView === 'history' && (
            <View className="mr-3 p-1">
              <Typography variant="headline-18" color="primary">
                ←
              </Typography>
            </View>
          )}
          <Typography variant="headline-24" color="primary">
            {currentView === 'statistics' ? 'Goals' : 'History'}
          </Typography>
        </View>
      </View>

      {/* Content */}
      {currentView === 'statistics' ? (
        <ScrollView className="flex-1">
          {/* Goal Progress Section */}
          <GoalProgress
            goals={storeGoals}
            inactiveGoals={inactiveGoals}
            currentPeriodProgress={goalProgress}
            onEditGoal={handleEditGoal}
            onDeleteGoal={handleDeleteGoal}
            onConcludeGoal={handleConcludeGoal}
            onActivateGoal={handleActivateGoal}
            onReorderGoals={reorderGoals}
          />

          {/* Badge Collection */}
          <BadgeCollection
            badges={badges}
            onDeleteBadge={deleteBadge}
          />

          {/* Shared Tag Stats */}
          <SharedTagStats
            sharingTags={sharingTags}
            sharedTagStats={sharedTagStats}
            onFetchStats={fetchJoinerStats}
            onRemoveJoiner={removeJoiner}
          />

          {/* Statistics View */}
          <StatisticsView
            chartData={chartData}
            recentSessions={todaysSessions}
            period={selectedPeriod}
            onPeriodChange={handlePeriodChange}
            onViewAllPress={handleViewAllPress}
          />
        </ScrollView>
      ) : (
        <View className="flex-1">Empty View</View>
      )}

      {/* Goal Configuration Modal */}
      <GoalConfigModal
        isVisible={showGoalModal}
        onClose={() => {
          setShowGoalModal(false);
          setEditingGoalId(null);
          setActivatingTagId(undefined);
        }}
        editingGoalId={editingGoalId}
        tagId={activatingTagId}
        onUpgrade={() => setShowUpgradePrompt(true)}
      />

      <UpgradePrompt
        isVisible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        onUpgrade={() => setShowUpgradeSheet(true)}
        limitType="goals"
      />

      <UpgradeSheet
        isVisible={showUpgradeSheet}
        onClose={() => setShowUpgradeSheet(false)}
      />
    </SwipeableTabWrapper>
    </SafeAreaView>
  );
}
