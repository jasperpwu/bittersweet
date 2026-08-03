import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, SafeAreaView, Alert, ScrollView } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Typography } from '../../src/components/ui/Typography';
import { colors } from '../../src/config/theme';
import { StatisticsView } from '../../src/components/analytics/StatisticsView';
import { GoalProgress } from '../../src/components/analytics/GoalProgress';
import { BadgeCollection } from '../../src/components/analytics/BadgeCollection';
import { CoachSection } from '../../src/components/analytics/CoachCard';
import { GoalConfigModal } from '../../src/components/modals/GoalConfigModal';
import { useUpgradeFlow } from '../../src/hooks/useTagUpgradeFlow';
import { useFocusActions, useAppStore } from '../../src/store';
import { useShallow } from 'zustand/react/shallow';
import { useAppSettings } from '../../src/store/unified-store';
import { useSubscriptionGate } from '../../src/hooks/useSubscriptionGate';
import { TimePeriod, FocusGoal, Badge, ChartSegment } from '../../src/store/types';
import { calculateGoalProgress } from '../../src/utils/goalProgress';
import { SwipeableTabWrapper } from '../../src/components/ui/SwipeableTabWrapper';
import { CoachMark } from '../../src/components/ui/CoachMark/CoachMark';
import { useTranslation } from 'react-i18next';

type ViewMode = 'statistics' | 'history';

export default function InsightsScreen() {
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] = useState<ViewMode>('statistics');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [activatingTagId, setActivatingTagId] = useState<string | undefined>(undefined);
  const { triggerUpgrade, upgradeModals } = useUpgradeFlow('goals');
  const { canActivateGoal } = useSubscriptionGate();
  const { preferences, updatePreferences } = useAppSettings();
  const weekStartDay = 1; // Always Monday

  // --- One-time Goals & Badges intro ---
  // A three-stop walkthrough: each step spotlights the element its copy is about
  // (activate a goal → a goal row to swipe → the badge collection) instead of
  // stacking every point on the header.
  // The "seen" flag lives in user_settings (cloud), so hold the overlay until the
  // cold-start sync has landed: a reinstall wipes local prefs while the Keychain
  // session survives, and showing it before the pull would replay the walkthrough
  // for an existing user. Unauthenticated users have no cloud row to wait on.
  const introSyncSettled = useAppStore(
    (s) => !s.auth.isAuthenticated || (!!s.sync.lastSyncTime && !s.sync.isSyncing)
  );
  const headerRef = useRef<View>(null);
  const goalActivateRef = useRef<View>(null);
  const goalRowRef = useRef<View>(null);
  const badgeSectionRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const [showIntro, setShowIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  // The tab can be mounted while another tab is on screen; measureInWindow returns
  // zeros then and CoachMark would silently skip rendering. Wait for focus.
  const isInsightsFocused = useIsFocused();

  useEffect(() => {
    if (preferences.hasSeenGoalsIntro || !introSyncSettled || !isInsightsFocused || showIntro)
      return;
    // Let the header finish laying out — CoachMark measures the target on show.
    const timer = setTimeout(() => setShowIntro(true), 500);
    return () => clearTimeout(timer);
  }, [preferences.hasSeenGoalsIntro, introSyncSettled, isInsightsFocused, showIntro]);

  const dismissIntro = useCallback(() => {
    setShowIntro(false);
    updatePreferences({ hasSeenGoalsIntro: true });
  }, [updatePreferences]);

  // Prep each step before CoachMark measures it (it waits `stepDelay` first):
  // the badge collection usually sits below the fold, so scroll it into view —
  // and the badge step demonstrates the swipe it describes on the goal row.
  const prepareIntroStep = useCallback((index: number) => {
    setIntroStep(index);
    const ref = index === 2 ? badgeSectionRef : null;
    if (!ref) {
      if (index === 0) scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    ref.current?.measureInWindow((_x, y, _w, h) => {
      if (h <= 0) return;
      // Land the target a comfortable distance below the header.
      scrollRef.current?.scrollTo({
        y: Math.max(0, scrollOffset.current + y - 180),
        animated: true,
      });
    });
  }, []);

  // Get data from focus store
  // Narrow subscription: only re-render when one of these fields changes, not on
  // every focus write (e.g. currentSession ticking during an active session).
  const { sessions, tags, goals } = useAppStore(
    useShallow((s) => ({
      sessions: s.focus.sessions,
      tags: s.focus.tags,
      goals: s.focus.goals,
    }))
  );
  const { deleteGoal, concludeGoal, deleteBadge, reorderGoals } = useFocusActions();

  // Extract sessions array from normalized state
  const safeSessions =
    sessions && sessions.allIds && sessions.byId
      ? sessions.allIds.map((id) => sessions.byId[id]).filter(Boolean)
      : [];

  // Get active goals preserving allIds order
  const storeGoals = useMemo(() => {
    if (!goals?.allIds || !goals?.byId) return [];
    return goals.allIds
      .map((id) => goals.byId[id])
      .filter((g): g is FocusGoal => !!g && g.isActive);
  }, [goals]);

  // Get inactive goals (not active, tag not deleted)
  const inactiveGoals = useMemo(() => {
    if (!goals?.allIds || !goals?.byId) return [];
    return goals.allIds
      .map((id) => goals.byId[id])
      .filter((g): g is FocusGoal => {
        if (!g || g.isActive) return false;
        const tag = tags?.byId?.[g.tagId];
        return !!tag && !tag.deletedAt;
      });
  }, [goals, tags]);

  // Get badges from store
  const badgeStore = useAppStore((state) => state.focus.badges);
  const badges = useMemo((): Badge[] => {
    if (!badgeStore?.allIds || !badgeStore?.byId) return [];
    return badgeStore.allIds.map((id: string) => badgeStore.byId[id]).filter(Boolean);
  }, [badgeStore]);

  // Create tag map for goal progress calculation
  const tagMap = useMemo(
    () =>
      (tags && tags.allIds && tags.byId ? tags.allIds : []).reduce(
        (map, id) => {
          if (tags && tags.byId) {
            const tag = tags.byId[id];
            if (tag) {
              map[id] = { id: tag.id, name: tag.name };
            }
          }
          return map;
        },
        {} as Record<string, { id: string; name: string }>
      ),
    [tags]
  );

  // Placeholder functions until focus slice is fully implemented
  const getSessionsByDate = () => ({});
  const deleteSession = (sessionId: string) => {
    console.log('Deleting session:', sessionId);
  };

  const getTagColor = (tagIdOrName: string): string => {
    const tag = tags?.byId?.[tagIdOrName];
    if (tag) return tag.color || colors.primary;
    if (tags?.allIds) {
      for (const id of tags.allIds) {
        const t = tags.byId[id];
        if (t?.name === tagIdOrName) return t.color || colors.primary;
      }
    }
    return colors.primary;
  };

  // Build segments from sessions in a time range
  const buildSegments = (rangeSessions: typeof safeSessions): ChartSegment[] => {
    const tagTotals: Record<string, number> = {};
    rangeSessions.forEach((session) => {
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
    const chartData: { date: Date; value: number; label: string; segments: ChartSegment[] }[] = [];

    if (period === 'weekly') {
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDay = new Date(date);
        nextDay.setDate(date.getDate() + 1);

        const daySessions = safeSessions.filter((session) => {
          const sessionDate = new Date(session.startTime);
          return sessionDate >= date && sessionDate < nextDay;
        });

        const totalMinutes = daySessions.reduce((total, session) => total + session.duration, 0);

        chartData.push({
          date,
          value: totalMinutes,
          label: date.toLocaleDateString(i18n.language, { weekday: 'short' }),
          segments: buildSegments(daySessions),
        });
      }
    } else if (period === 'monthly') {
      for (let i = 3; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - i * 7 - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const weekSessions = safeSessions.filter((session) => {
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
        chunkStart.setHours(now.getHours() - i * 4, 0, 0, 0);

        const chunkEnd = new Date(chunkStart);
        chunkEnd.setHours(chunkStart.getHours() + 4);

        const chunkSessions = safeSessions.filter((session) => {
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
  const goalProgress = useMemo(
    () => calculateGoalProgress(storeGoals, safeSessions, tagMap, weekStartDay),
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

  const handleDeleteGoal = useCallback(
    (goalId: string) => {
      const goal = storeGoals.find((g) => g.id === goalId);
      const goalTagId = goal?.tagId || (goal as any)?.tagIds?.[0];
      const tag = goalTagId ? tags?.byId?.[goalTagId] : null;
      const goalName =
        goal?.customName ||
        (tag
          ? t('insights.goalSuffix', { icon: tag.icon, name: tag.name })
          : t('insights.thisGoal'));

      Alert.alert(
        t('insights.deactivateTitle'),
        t('insights.deactivateBody', { name: `"${goalName}"` }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('insights.deactivate'),
            style: 'destructive',
            onPress: () => deleteGoal(goalId),
          },
        ],
        { cancelable: true }
      );
    },
    [storeGoals, tags, deleteGoal]
  );

  const handleConcludeGoal = useCallback(
    (goalId: string) => {
      const goal = storeGoals.find((g) => g.id === goalId);
      const goalTagId = goal?.tagId || (goal as any)?.tagIds?.[0];
      const tag = goalTagId ? tags?.byId?.[goalTagId] : null;
      const goalName =
        goal?.customName ||
        (tag
          ? t('insights.goalSuffix', { icon: tag.icon, name: tag.name })
          : t('insights.thisGoal'));

      const hasExistingBadge = badges.some((b) => b.goalId === goalId);
      const message = hasExistingBadge
        ? t('insights.concludeBodyExisting', { name: `"${goalName}"` })
        : t('insights.concludeBodyNew', { name: `"${goalName}"` });

      Alert.alert(
        t('insights.concludeTitle'),
        message,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('insights.conclude'),
            style: 'default',
            onPress: () => concludeGoal(goalId),
          },
        ],
        { cancelable: true }
      );
    },
    [storeGoals, tags, badges, concludeGoal]
  );

  const handleActivateGoal = useCallback(
    (goalId: string) => {
      if (!canActivateGoal) {
        triggerUpgrade();
        return;
      }
      const goal = goals?.byId?.[goalId];
      setEditingGoalId(goalId);
      setActivatingTagId(goal?.tagId);
      setShowGoalModal(true);
    },
    [canActivateGoal, goals]
  );

  return (
    // The CoachMark overlay is a sibling of the SafeAreaView, not a child: it
    // positions itself with absoluteFill against measureInWindow coordinates, so
    // its container must start at the window origin. Nested inside the SafeAreaView
    // (or SwipeableTabWrapper) the spotlight would sit a top-inset too low.
    <View className="flex-1 bg-light-bg dark:bg-dark-bg">
      <SafeAreaView className="flex-1">
        <SwipeableTabWrapper currentTab="insights">
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-4">
            <View ref={headerRef} className="flex-row items-center">
              {currentView === 'history' && (
                <View className="mr-3 p-1">
                  <Typography variant="headline-18" color="primary">
                    ←
                  </Typography>
                </View>
              )}
              <Typography variant="headline-24" color="primary">
                {currentView === 'statistics'
                  ? t('insights.goalsTitle')
                  : t('insights.historyTitle')}
              </Typography>
            </View>
          </View>

          {/* Content */}
          {currentView === 'statistics' ? (
            <ScrollView
              ref={scrollRef}
              className="flex-1"
              scrollEventThrottle={16}
              onScroll={(e) => {
                scrollOffset.current = e.nativeEvent.contentOffset.y;
              }}>
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
                introActivateRef={goalActivateRef}
                introGoalRowRef={goalRowRef}
                introSwipeOpen={showIntro && introStep === 1}
              />

              {/* Badge Collection */}
              <BadgeCollection
                badges={badges}
                onDeleteBadge={deleteBadge}
                sectionRef={badgeSectionRef}
              />

              {/* AI Focus Coach — collapsible weekly reports */}
              <CoachSection />

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
            onUpgrade={triggerUpgrade}
          />

          {/* Goals paywall — GoalConfigModal fires onUpgrade only after it has
            fully closed, and prompt→sheet is sequenced inside the hook, so no
            modal ever presents over another that's still on screen. */}
          {upgradeModals}
        </SwipeableTabWrapper>
      </SafeAreaView>

      {/* First-visit walkthrough — one spotlight per point. The header is the
          fallback target for any step whose element isn't mounted. */}
      <CoachMark
        visible={showIntro && !preferences.hasSeenGoalsIntro}
        targetRef={headerRef}
        steps={[
          {
            targetRef: goalActivateRef,
            title: t('insights.introTitle'),
            message: t('insights.introStep1'),
          },
          {
            targetRef: goalRowRef,
            title: t('insights.introStep2Title'),
            message: t('insights.introStep2'),
          },
          {
            targetRef: badgeSectionRef,
            title: t('insights.introStep3Title'),
            message: t('insights.introStep3'),
          },
        ]}
        onStepChange={prepareIntroStep}
        stepDelay={400}
        nextLabel={t('common.next')}
        dismissLabel={t('insights.introDismiss')}
        onDismiss={dismissIntro}
      />
    </View>
  );
}
