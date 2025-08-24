/**
 * Advanced memoized selectors for all store domains
 * Addresses Requirements: 3.3, 3.4, 3.5, 4.4, 4.5, 6.1, 6.2
 */

import { useMemo } from 'react';
import { RootStore, FocusSession, Task, User, Squad, Challenge, ChartDataPoint, ProductivityInsights } from '../types';
import { useAppStore } from '../index';

// Selector utilities
export const createMemoizedSelector = <T, R>(
  selector: (state: T) => R,
  equalityFn?: (a: R, b: R) => boolean
) => {
  return (state: T): R => {
    return useMemo(() => selector(state), [selector, state]);
  };
};

// Auth selectors
export const selectUser = (state: RootStore) => state.auth.user;
export const selectIsAuthenticated = (state: RootStore) => state.auth.isAuthenticated;
export const selectAuthToken = (state: RootStore) => state.auth.authToken;
export const selectLoginState = (state: RootStore) => state.auth.loginState;

// Focus selectors
export const selectFocusSessions = (state: RootStore) => state.focus.sessions;
export const selectFocusCategories = (state: RootStore) => state.focus.categories;
export const selectFocusTags = (state: RootStore) => state.focus.tags;
export const selectCurrentSession = (state: RootStore) => state.focus.currentSession;
export const selectFocusSettings = (state: RootStore) => state.focus.settings;

// Computed focus selectors
export const selectAllFocusSessions = (state: RootStore): FocusSession[] => {
  const { sessions } = state.focus;
  return sessions.allIds.map(id => sessions.byId[id]).filter(Boolean);
};

export const selectCompletedSessions = (state: RootStore): FocusSession[] => {
  return selectAllFocusSessions(state).filter(session => session.status === 'completed');
};

export const selectActiveSession = (state: RootStore): FocusSession | null => {
  return selectAllFocusSessions(state).find(session => session.status === 'active') || null;
};

export const selectSessionsByDateRange = (startDate: Date, endDate: Date) => (state: RootStore): FocusSession[] => {
  return selectAllFocusSessions(state).filter(session => {
    const sessionDate = new Date(session.startTime);
    return sessionDate >= startDate && sessionDate <= endDate;
  });
};

export const selectFocusStats = (state: RootStore) => {
  const sessions = selectCompletedSessions(state);
  
  return useMemo(() => {
    const totalSessions = sessions.length;
    const totalFocusTime = sessions.reduce((total, session) => total + session.duration, 0);
    const averageSessionLength = totalSessions > 0 ? totalFocusTime / totalSessions : 0;
    
    // Calculate streak
    const sortedSessions = sessions
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sortedSessions.length; i++) {
      const sessionDate = new Date(sortedSessions[i].startTime);
      sessionDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((today.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (i === 0 && daysDiff <= 1) {
        currentStreak = 1;
        tempStreak = 1;
      } else if (i > 0) {
        const prevSessionDate = new Date(sortedSessions[i - 1].startTime);
        prevSessionDate.setHours(0, 0, 0, 0);
        const prevDaysDiff = Math.floor((prevSessionDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (prevDaysDiff === 1) {
          tempStreak++;
          if (i === 0 || daysDiff <= 1) {
            currentStreak = tempStreak;
          }
        } else {
          tempStreak = 1;
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak);
    }
    
    const completionRate = totalSessions > 0 
      ? sessions.filter(s => s.status === 'completed').length / totalSessions 
      : 0;
    
    return {
      totalSessions,
      totalFocusTime,
      currentStreak,
      longestStreak,
      averageSessionLength,
      completionRate
    };
  }, [sessions]);
};

// Task selectors
export const selectTasks = (state: RootStore) => state.tasks.tasks;
export const selectSelectedDate = (state: RootStore) => state.tasks.selectedDate;
export const selectViewMode = (state: RootStore) => state.tasks.viewMode;
export const selectCurrentWeekStart = (state: RootStore) => state.tasks.currentWeekStart;

export const selectAllTasks = (state: RootStore): Task[] => {
  const { tasks } = state.tasks;
  return tasks.allIds.map(id => tasks.byId[id]).filter(Boolean);
};

export const selectTasksForDate = (date: Date) => (state: RootStore): Task[] => {
  const dateStr = date.toDateString();
  return selectAllTasks(state).filter(task => 
    new Date(task.date).toDateString() === dateStr
  );
};

export const selectTasksForWeek = (weekStart: Date) => (state: RootStore): Task[] => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  return selectAllTasks(state).filter(task => {
    const taskDate = new Date(task.date);
    return taskDate >= weekStart && taskDate <= weekEnd;
  });
};

export const selectActiveTask = (state: RootStore): Task | null => {
  return selectAllTasks(state).find(task => task.status === 'active') || null;
};

export const selectCompletedTasks = (state: RootStore): Task[] => {
  return selectAllTasks(state).filter(task => task.status === 'completed');
};

// Rewards selectors
export const selectRewardsBalance = (state: RootStore) => state.rewards.balance;
export const selectTotalEarned = (state: RootStore) => state.rewards.totalEarned;
export const selectTotalSpent = (state: RootStore) => state.rewards.totalSpent;
export const selectTransactions = (state: RootStore) => state.rewards.transactions;
export const selectUnlockableApps = (state: RootStore) => state.rewards.unlockableApps;

export const selectRecentTransactions = (limit: number = 10) => (state: RootStore) => {
  const { transactions } = state.rewards;
  return transactions.allIds
    .map(id => transactions.byId[id])
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
};

export const selectUnlockedApps = (state: RootStore) => {
  const { unlockableApps } = state.rewards;
  return unlockableApps.allIds
    .map(id => unlockableApps.byId[id])
    .filter(app => app && app.isUnlocked);
};

export const selectAvailableApps = (state: RootStore) => {
  const { unlockableApps } = state.rewards;
  return unlockableApps.allIds
    .map(id => unlockableApps.byId[id])
    .filter(app => app && !app.isUnlocked);
};

// Social selectors
export const selectSquads = (state: RootStore) => state.social.squads;
export const selectChallenges = (state: RootStore) => state.social.challenges;
export const selectFriends = (state: RootStore) => state.social.friends;
export const selectUserSquads = (state: RootStore) => state.social.userSquads;
export const selectActiveChallenges = (state: RootStore) => state.social.activeChallenges;

export const selectUserSquadsList = (state: RootStore): Squad[] => {
  const { squads, userSquads } = state.social;
  return userSquads.map(squadId => squads.byId[squadId]).filter(Boolean);
};

export const selectActiveChallengesList = (state: RootStore): Challenge[] => {
  const { challenges, activeChallenges } = state.social;
  return activeChallenges.map(challengeId => challenges.byId[challengeId]).filter(Boolean);
};

// Settings selectors
export const selectSettings = (state: RootStore) => state.settings.settings;
export const selectTheme = (state: RootStore) => state.settings.settings.theme;
export const selectNotificationSettings = (state: RootStore) => state.settings.settings.notifications;
export const selectPrivacySettings = (state: RootStore) => state.settings.settings.privacy;

// UI selectors
export const selectIsHydrated = (state: RootStore) => state.ui.isHydrated;
export const selectModals = (state: RootStore) => state.ui.modals;
export const selectLoading = (state: RootStore) => state.ui.loading;
export const selectErrors = (state: RootStore) => state.ui.errors;

export const selectModalState = (modalType: string) => (state: RootStore) => {
  return state.ui.modals[modalType] || { isVisible: false, type: modalType, data: null };
};

export const selectIsLoading = (action?: string) => (state: RootStore) => {
  if (action) {
    return state.ui.loading.actions[action] || false;
  }
  return state.ui.loading.global;
};

// Cross-domain selectors
export const selectDashboardData = (state: RootStore) => {
  const focusStats = selectFocusStats(state);
  const activeTask = selectActiveTask(state);
  const currentSession = selectCurrentSession(state);
  const balance = selectRewardsBalance(state);
  const todayTasks = selectTasksForDate(new Date())(state);
  
  return useMemo(() => ({
    focusStats,
    activeTask,
    currentSession,
    balance,
    todayTasks,
    completedTodayTasks: todayTasks.filter(task => task.status === 'completed').length,
    totalTodayTasks: todayTasks.length
  }), [focusStats, activeTask, currentSession, balance, todayTasks]);
};

export const selectInsightsData = (state: RootStore) => {
  const sessions = selectCompletedSessions(state);
  const tasks = selectCompletedTasks(state);
  
  return useMemo(() => {
    // Calculate productivity insights
    const sessionsByHour = sessions.reduce((acc, session) => {
      const hour = new Date(session.startTime).getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const bestHour = Object.entries(sessionsByHour)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    const sessionsByDay = sessions.reduce((acc, session) => {
      const day = new Date(session.startTime).getDay();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    const bestDay = Object.entries(sessionsByDay)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      bestTimeOfDay: bestHour ? `${bestHour}:00` : 'No data',
      mostProductiveDay: bestDay ? dayNames[parseInt(bestDay)] : 'No data',
      totalSessions: sessions.length,
      totalTasks: tasks.length,
      averageSessionLength: sessions.length > 0 
        ? sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length 
        : 0
    };
  }, [sessions, tasks]);
};

// Performance monitoring selectors
export const selectPerformanceMetrics = (state: RootStore) => {
  return useMemo(() => {
    const totalEntities = 
      state.focus.sessions.allIds.length +
      state.tasks.tasks.allIds.length +
      state.rewards.transactions.allIds.length +
      state.social.squads.allIds.length +
      state.social.challenges.allIds.length;
    
    const loadingActions = Object.keys(state.ui.loading.actions).length;
    const errorCount = state.ui.errors.length;
    
    return {
      totalEntities,
      loadingActions,
      errorCount,
      isHydrated: state.ui.isHydrated
    };
  }, [state]);
};