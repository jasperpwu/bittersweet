/**
 * Optimized hooks with advanced performance features
 * Addresses Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '../index';
import { RootStore } from '../types';
import { usePerformanceMonitor, useMemoryManagement, CacheManager } from '../performance';
import * as selectors from '../selectors';

// High-performance dashboard hook with caching
export const useOptimizedDashboard = () => {
  const cacheKey = 'dashboard_data';
  const componentName = 'Dashboard';
  
  usePerformanceMonitor(componentName);
  const { registerCleanup } = useMemoryManagement(componentName);
  
  const dashboardData = useAppStore(selectors.selectDashboardData);
  
  // Cache the dashboard data
  useEffect(() => {
    CacheManager.set(cacheKey, dashboardData, 2 * 60 * 1000); // 2 minutes TTL
  }, [dashboardData]);
  
  // Register cleanup for cache
  useEffect(() => {
    registerCleanup(() => {
      CacheManager.delete(cacheKey);
    });
  }, [registerCleanup]);
  
  return dashboardData;
};

// Optimized focus session hook with lazy loading
export const useOptimizedFocusSession = (sessionId: string, shouldLoad: boolean = true) => {
  const componentName = 'FocusSession';
  
  usePerformanceMonitor(componentName);
  const { registerCleanup } = useMemoryManagement(componentName);
  
  const session = useAppStore(
    useCallback(
      (state: RootStore) => shouldLoad ? state.focus.sessions.byId[sessionId] : null,
      [sessionId, shouldLoad]
    )
  );
  
  // Memoize session progress calculation
  const sessionProgress = useMemo(() => {
    if (!session || session.status !== 'active') {
      return null;
    }
    
    const elapsed = Date.now() - new Date(session.startTime).getTime();
    const progress = elapsed / (session.targetDuration * 60 * 1000);
    
    return {
      elapsed: Math.floor(elapsed / 1000), // seconds
      progress: Math.max(0, Math.min(1, progress)),
      isOvertime: progress > 1,
      overtimeAmount: Math.max(0, elapsed - (session.targetDuration * 60 * 1000))
    };
  }, [session]);
  
  return {
    session,
    sessionProgress,
    isLoaded: shouldLoad && session !== null
  };
};

// Optimized tasks list with virtualization support
export const useOptimizedTasksList = (date: Date, limit: number = 50) => {
  const componentName = 'TasksList';
  
  usePerformanceMonitor(componentName);
  const { registerCleanup } = useMemoryManagement(componentName);
  
  const allTasks = useAppStore(
    useCallback(
      (state: RootStore) => selectors.selectTasksForDate(date)(state),
      [date]
    )
  );
  
  // Memoize limited and sorted tasks
  const optimizedTasks = useMemo(() => {
    return allTasks
      .sort((a, b) => {
        // Sort by priority, then by start time
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      })
      .slice(0, limit);
  }, [allTasks, limit]);
  
  // Register cleanup
  useEffect(() => {
    registerCleanup(() => {
      // Clear any task-related caches
      CacheManager.delete(`tasks_${date.toDateString()}`);
    });
  }, [registerCleanup, date]);
  
  return {
    tasks: optimizedTasks,
    totalTasks: allTasks.length,
    hasMore: allTasks.length > limit
  };
};

// Optimized insights hook with computed analytics
export const useOptimizedInsights = (period: 'week' | 'month' | 'year' = 'week') => {
  const componentName = 'Insights';
  
  usePerformanceMonitor(componentName);
  const { registerCleanup } = useMemoryManagement(componentName);
  
  const insightsData = useAppStore(selectors.selectInsightsData);
  const focusStats = useAppStore(selectors.selectFocusStats);
  
  // Compute period-specific analytics
  const periodAnalytics = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    return {
      period,
      startDate,
      endDate: now,
      ...insightsData,
      ...focusStats
    };
  }, [period, insightsData, focusStats]);
  
  // Cache analytics data
  useEffect(() => {
    const cacheKey = `insights_${period}`;
    CacheManager.set(cacheKey, periodAnalytics, 5 * 60 * 1000); // 5 minutes TTL
    
    registerCleanup(() => {
      CacheManager.delete(cacheKey);
    });
  }, [periodAnalytics, period, registerCleanup]);
  
  return periodAnalytics;
};

// Optimized rewards hook with transaction history
export const useOptimizedRewards = (transactionLimit: number = 20) => {
  const componentName = 'Rewards';
  
  usePerformanceMonitor(componentName);
  const { registerCleanup } = useMemoryManagement(componentName);
  
  const balance = useAppStore(selectors.selectRewardsBalance);
  const totalEarned = useAppStore(selectors.selectTotalEarned);
  const totalSpent = useAppStore(selectors.selectTotalSpent);
  const recentTransactions = useAppStore(
    useCallback(
      (state: RootStore) => selectors.selectRecentTransactions(transactionLimit)(state),
      [transactionLimit]
    )
  );
  
  // Compute spending analytics
  const spendingAnalytics = useMemo(() => {
    const earnedTransactions = recentTransactions.filter(t => t.type === 'earned');
    const spentTransactions = recentTransactions.filter(t => t.type === 'spent');
    
    const avgEarned = earnedTransactions.length > 0 
      ? earnedTransactions.reduce((sum, t) => sum + t.amount, 0) / earnedTransactions.length 
      : 0;
    
    const avgSpent = spentTransactions.length > 0 
      ? spentTransactions.reduce((sum, t) => sum + t.amount, 0) / spentTransactions.length 
      : 0;
    
    return {
      avgEarned,
      avgSpent,
      netGain: totalEarned - totalSpent,
      savingsRate: totalEarned > 0 ? (balance / totalEarned) : 0
    };
  }, [recentTransactions, balance, totalEarned, totalSpent]);
  
  return {
    balance,
    totalEarned,
    totalSpent,
    recentTransactions,
    spendingAnalytics
  };
};

// Optimized social hook with squad analytics
export const useOptimizedSocial = () => {
  const componentName = 'Social';
  
  usePerformanceMonitor(componentName);
  const { registerCleanup } = useMemoryManagement(componentName);
  
  const userSquads = useAppStore(selectors.selectUserSquadsList);
  const activeChallenges = useAppStore(selectors.selectActiveChallengesList);
  
  // Compute social analytics
  const socialAnalytics = useMemo(() => {
    const totalMembers = userSquads.reduce((total, squad) => total + squad.memberIds.length, 0);
    const avgSquadSize = userSquads.length > 0 ? totalMembers / userSquads.length : 0;
    
    const upcomingChallenges = activeChallenges.filter(
      challenge => challenge.status === 'upcoming'
    );
    
    const ongoingChallenges = activeChallenges.filter(
      challenge => challenge.status === 'active'
    );
    
    return {
      totalSquads: userSquads.length,
      totalMembers,
      avgSquadSize,
      totalChallenges: activeChallenges.length,
      upcomingChallenges: upcomingChallenges.length,
      ongoingChallenges: ongoingChallenges.length
    };
  }, [userSquads, activeChallenges]);
  
  return {
    userSquads,
    activeChallenges,
    socialAnalytics
  };
};

// Performance monitoring hook for components
export const useComponentPerformance = (componentName: string) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(Date.now());
  const { registerCleanup } = useMemoryManagement(componentName);
  
  usePerformanceMonitor(componentName);
  
  useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;
    lastRenderTime.current = now;
    
    if (__DEV__ && timeSinceLastRender > 16) {
      console.warn(`Slow render in ${componentName}: ${timeSinceLastRender}ms`);
    }
  });
  
  return {
    renderCount: renderCount.current,
    componentName,
    registerCleanup
  };
};

// Batch update hook for performance
export const useBatchUpdates = (batchId: string, batchSize: number = 10) => {
  const { BatchProcessor } = require('../performance');
  const pendingUpdates = useRef<(() => void)[]>([]);
  
  const addUpdate = useCallback((update: () => void) => {
    BatchProcessor.addToBatch(batchId, update, batchSize);
  }, [batchId, batchSize]);
  
  const flushUpdates = useCallback(() => {
    BatchProcessor.flushBatch(batchId);
  }, [batchId]);
  
  return {
    addUpdate,
    flushUpdates
  };
};