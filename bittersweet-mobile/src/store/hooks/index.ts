/**
 * Typed hooks with selective subscriptions and performance optimization
 * Addresses Requirements: 3.3, 3.4, 6.1, 6.2, 6.3, 6.4
 */

import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { useAppStore } from '../index';
import { RootStore, FocusSession, Task, User, Squad, Challenge } from '../types';
import * as selectors from '../selectors';

// Performance monitoring hook
export const useStorePerformance = () => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  
  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    if (__DEV__ && timeSinceLastRender > 16) {
      console.warn(`Slow render detected: ${timeSinceLastRender}ms`);
    }
  });
  
  return {
    renderCount: renderCount.current,
    lastRenderTime: lastRenderTime.current
  };
};

// Selective subscription hooks for performance
export const useAuthUser = () => useAppStore(selectors.selectUser);
export const useIsAuthenticated = () => useAppStore(selectors.selectIsAuthenticated);
export const useAuthToken = () => useAppStore(selectors.selectAuthToken);
export const useLoginState = () => useAppStore(selectors.selectLoginState);

// Focus hooks with memoization
export const useFocusSessions = () => useAppStore(selectors.selectAllFocusSessions);
export const useCompletedSessions = () => useAppStore(selectors.selectCompletedSessions);
export const useCurrentSession = () => useAppStore(selectors.selectCurrentSession);
export const useActiveSession = () => useAppStore(selectors.selectActiveSession);
export const useFocusSettings = () => useAppStore(selectors.selectFocusSettings);
export const useFocusStats = () => useAppStore(selectors.selectFocusStats);

// Parameterized focus hooks
export const useSessionsByDateRange = (startDate: Date, endDate: Date) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => selectors.selectSessionsByDateRange(startDate, endDate)(state),
      [startDate, endDate]
    )
  );
};

export const useFocusSession = (sessionId: string) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => state.focus.sessions.byId[sessionId],
      [sessionId]
    )
  );
};

// Task hooks with memoization
export const useTasks = () => useAppStore(selectors.selectAllTasks);
export const useSelectedDate = () => useAppStore(selectors.selectSelectedDate);
export const useViewMode = () => useAppStore(selectors.selectViewMode);
export const useCurrentWeekStart = () => useAppStore(selectors.selectCurrentWeekStart);
export const useActiveTask = () => useAppStore(selectors.selectActiveTask);
export const useCompletedTasks = () => useAppStore(selectors.selectCompletedTasks);

// Parameterized task hooks
export const useTasksForDate = (date: Date) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => selectors.selectTasksForDate(date)(state),
      [date]
    )
  );
};

export const useTasksForWeek = (weekStart: Date) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => selectors.selectTasksForWeek(weekStart)(state),
      [weekStart]
    )
  );
};

export const useTask = (taskId: string) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => state.tasks.tasks.byId[taskId],
      [taskId]
    )
  );
};

// Rewards hooks
export const useRewardsBalance = () => useAppStore(selectors.selectRewardsBalance);
export const useTotalEarned = () => useAppStore(selectors.selectTotalEarned);
export const useTotalSpent = () => useAppStore(selectors.selectTotalSpent);
export const useUnlockedApps = () => useAppStore(selectors.selectUnlockedApps);
export const useAvailableApps = () => useAppStore(selectors.selectAvailableApps);

export const useRecentTransactions = (limit: number = 10) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => selectors.selectRecentTransactions(limit)(state),
      [limit]
    )
  );
};

// Social hooks
export const useUserSquads = () => useAppStore(selectors.selectUserSquadsList);
export const useActiveChallenges = () => useAppStore(selectors.selectActiveChallengesList);

export const useSquad = (squadId: string) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => state.social.squads.byId[squadId],
      [squadId]
    )
  );
};

export const useChallenge = (challengeId: string) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => state.social.challenges.byId[challengeId],
      [challengeId]
    )
  );
};

// Settings hooks
export const useTheme = () => useAppStore(selectors.selectTheme);
export const useNotificationSettings = () => useAppStore(selectors.selectNotificationSettings);
export const usePrivacySettings = () => useAppStore(selectors.selectPrivacySettings);
export const useAppSettings = () => useAppStore(selectors.selectSettings);

// UI hooks
export const useIsHydrated = () => useAppStore(selectors.selectIsHydrated);
export const useErrors = () => useAppStore(selectors.selectErrors);

export const useModal = (modalType: string) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => selectors.selectModalState(modalType)(state),
      [modalType]
    )
  );
};

export const useIsLoading = (action?: string) => {
  return useAppStore(
    useCallback(
      (state: RootStore) => selectors.selectIsLoading(action)(state),
      [action]
    )
  );
};

// Cross-domain hooks
export const useDashboardData = () => useAppStore(selectors.selectDashboardData);
export const useInsightsData = () => useAppStore(selectors.selectInsightsData);

// Performance monitoring hooks
export const usePerformanceMetrics = () => useAppStore(selectors.selectPerformanceMetrics);

// Computed hooks with complex logic
export const useSessionProgress = () => {
  const currentSession = useCurrentSession();
  
  return useMemo(() => {
    if (!currentSession.session || !currentSession.isRunning) {
      return null;
    }
    
    const { session, remainingTime } = currentSession;
    const elapsed = session.targetDuration - remainingTime;
    const progress = elapsed / session.targetDuration;
    
    return {
      elapsed,
      remaining: remainingTime,
      progress: Math.max(0, Math.min(1, progress)),
      isOvertime: remainingTime < 0,
      overtimeAmount: remainingTime < 0 ? Math.abs(remainingTime) : 0
    };
  }, [currentSession]);
};

export const useTaskProgress = (taskId: string) => {
  const task = useTask(taskId);
  const sessions = useFocusSessions();
  
  return useMemo(() => {
    if (!task) return null;
    
    const taskSessions = sessions.filter(session => 
      task.focusSessionIds.includes(session.id) && session.status === 'completed'
    );
    
    const totalFocusTime = taskSessions.reduce((total, session) => total + session.duration, 0);
    const progress = task.duration > 0 ? totalFocusTime / task.duration : 0;
    
    return {
      totalFocusTime,
      estimatedTime: task.duration,
      progress: Math.max(0, Math.min(1, progress)),
      isCompleted: task.status === 'completed',
      isOvertime: totalFocusTime > task.duration,
      overtimeAmount: Math.max(0, totalFocusTime - task.duration),
      sessionsCount: taskSessions.length
    };
  }, [task, sessions]);
};

export const useWeeklyStats = () => {
  const currentWeekStart = useCurrentWeekStart();
  const sessions = useSessionsByDateRange(
    currentWeekStart,
    new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000)
  );
  const tasks = useTasksForWeek(currentWeekStart);
  
  return useMemo(() => {
    const completedSessions = sessions.filter(s => s.status === 'completed');
    const completedTasks = tasks.filter(t => t.status === 'completed');
    
    const totalFocusTime = completedSessions.reduce((total, session) => total + session.duration, 0);
    const averageSessionLength = completedSessions.length > 0 
      ? totalFocusTime / completedSessions.length 
      : 0;
    
    // Group by day
    const dailyStats = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + index);
      
      const daySessions = completedSessions.filter(session => 
        new Date(session.startTime).toDateString() === date.toDateString()
      );
      
      const dayTasks = tasks.filter(task => 
        new Date(task.date).toDateString() === date.toDateString()
      );
      
      const dayCompletedTasks = dayTasks.filter(t => t.status === 'completed');
      
      return {
        date,
        sessions: daySessions.length,
        focusTime: daySessions.reduce((total, s) => total + s.duration, 0),
        tasks: dayTasks.length,
        completedTasks: dayCompletedTasks.length,
        taskCompletionRate: dayTasks.length > 0 ? dayCompletedTasks.length / dayTasks.length : 0
      };
    });
    
    return {
      totalSessions: completedSessions.length,
      totalFocusTime,
      averageSessionLength,
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      taskCompletionRate: tasks.length > 0 ? completedTasks.length / tasks.length : 0,
      dailyStats
    };
  }, [sessions, tasks, currentWeekStart]);
};

// Debounced hooks for performance
export const useDebouncedSelector = <T>(
  selector: (state: RootStore) => T,
  delay: number = 300
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const [debouncedValue, setDebouncedValue] = useState<T>();
  
  const currentValue = useAppStore(selector);
  
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(currentValue);
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [currentValue, delay]);
  
  return debouncedValue;
};

// Lazy loading hooks
export const useLazyData = <T>(
  selector: (state: RootStore) => T,
  shouldLoad: boolean
) => {
  const data = useAppStore(shouldLoad ? selector : () => null as T);
  
  return useMemo(() => ({
    data,
    isLoaded: shouldLoad && data !== null
  }), [data, shouldLoad]);
};

// Memory management hooks
export const useMemoryOptimizedList = <T>(
  items: T[],
  maxItems: number = 100
) => {
  return useMemo(() => {
    if (items.length <= maxItems) {
      return items;
    }
    
    // Keep most recent items
    return items.slice(-maxItems);
  }, [items, maxItems]);
};

// Subscription management hook
export const useStoreSubscription = (
  callback: (state: RootStore) => void,
  deps: any[] = []
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe((state) => {
      callbackRef.current(state);
    });
    
    return unsubscribe;
  }, deps);
};

// Export optimized hooks
export * from './optimized';