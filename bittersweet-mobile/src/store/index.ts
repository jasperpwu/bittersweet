/**
 * Unified Zustand store with middleware integration
 * Addresses Requirements: 2.3, 2.4, 3.1, 3.2, 4.1, 7.1, 7.2, 7.3, 9.1
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { RootStore } from './types';
import { createNormalizedState } from './utils/entityManager';
import { storeEventBus, createEventEmitter, createEventListener } from './utils/eventBus';
import { createPerformanceMiddleware, initializePerformanceMonitoring } from './performance';
import { persistenceConfig } from './middleware/persistence';

// Import slice creators (will be implemented in subsequent tasks)
import { createAuthSlice } from './slices/authSlice';
import { createFocusSlice } from './slices/focusSlice';
import { createTasksSlice } from './slices/tasksSlice';
import { createRewardsSlice } from './slices/rewardsSlice';
import { createSocialSlice } from './slices/socialSlice';
import { createSettingsSlice } from './slices/settingsSlice';

// Temporarily create a simple UI slice inline to avoid import issues
const createUISlice = (set: any, get: any, api: any) => ({
  isHydrated: true,
  modals: {},
  loading: { global: false, actions: {} },
  errors: [],
  showModal: (type: string, data?: any) => {},
  hideModal: (type: string) => {},
  setLoading: (action: string, loading: boolean) => {},
  addError: (error: any) => {},
  clearError: (errorId: string) => {},
  clearAllErrors: () => {},
  isModalVisible: (type: string) => false,
  getModalData: (type: string) => null,
  isLoading: (action?: string) => false,
  getErrors: () => [],
});

/**
 * Create the unified store with all middleware
 */
export const useAppStore = create<RootStore>()(
  devtools(
    persist(
      createPerformanceMiddleware({
        enablePerformanceMonitoring: __DEV__,
        enableMemoryCleanup: true,
        memoryThreshold: 50
      })(
        (set: any, get: any, api: any) => {
      try {
        const store = {
          auth: createAuthSlice(set, get, api),
          focus: createFocusSlice(set, get, api),
          tasks: createTasksSlice(set, get, api),
          rewards: createRewardsSlice(set, get, api),
          social: createSocialSlice(set, get, api),
          settings: createSettingsSlice(set, get, api),
          ui: createUISlice(set, get, api),
        };
        
        // Set hydration flag
        if (store.ui) {
          store.ui.isHydrated = true;
        }
        
        if (__DEV__) {
          console.log('✅ Store slices created successfully:', Object.keys(store));
          console.log('✅ Tasks slice functions:', store.tasks ? Object.keys(store.tasks).filter(key => typeof (store.tasks as any)[key] === 'function') : 'no tasks');
          console.log('✅ Tasks setSelectedDate type:', typeof store.tasks?.setSelectedDate);
        }
        
        return store;
      } catch (error) {
        console.error('❌ Error creating store slices:', error);
        throw error;
      }
    }),
    persistenceConfig
    ),
    { name: 'bittersweet-store' }
  )
);

/**
 * Typed hooks for accessing store slices
 */
export const useAuth = () => useAppStore((state) => {
  if (!state || !state.auth) {
    if (__DEV__) {
      console.warn('Auth slice not initialized, state:', state);
    }
    return {
      user: null,
      isAuthenticated: false,
      authToken: null,
      refreshToken: null,
      loginState: { data: null, loading: false, error: null, lastFetch: null },
      login: async () => { throw new Error('Auth not initialized'); },
      logout: () => { console.warn('Auth not initialized'); },
      refreshAuth: async () => { throw new Error('Auth not initialized'); },
      updateProfile: async () => { throw new Error('Auth not initialized'); },
      getUser: () => null,
      isLoggedIn: () => false,
    };
  }
  return state.auth;
});

export const useFocus = () => useAppStore((state) => {
  if (!state.focus) {
    console.warn('Focus slice not initialized');
    return {
      sessions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      categories: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      tags: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      currentSession: { session: null, isRunning: false, remainingTime: 0, startedAt: null },
      settings: {
        defaultDuration: 25,
        breakDuration: 5,
        longBreakDuration: 15,
        sessionsUntilLongBreak: 4,
        soundEnabled: true,
        vibrationEnabled: true,
        autoStartBreaks: false,
        autoStartSessions: false,
      },
    };
  }
  return state.focus;
});
export const useTasks = () => useAppStore((state) => {
  if (!state.tasks) {
    console.warn('Tasks slice not initialized');
    const today = new Date();
    const currentDay = today.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    return {
      tasks: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      selectedDate: new Date(),
      viewMode: 'day' as const,
      currentWeekStart: weekStart,
    };
  }
  
  // Ensure selectedDate is always a valid Date object
  const selectedDate = state.tasks.selectedDate instanceof Date 
    ? state.tasks.selectedDate 
    : new Date(state.tasks.selectedDate || new Date());
    
  // Ensure currentWeekStart is always a valid Date object
  const currentWeekStart = state.tasks.currentWeekStart instanceof Date
    ? state.tasks.currentWeekStart
    : new Date(state.tasks.currentWeekStart || (() => {
        const today = new Date();
        const currentDay = today.getDay();
        const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - daysFromMonday);
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
      })());
  
  return {
    ...state.tasks,
    selectedDate,
    currentWeekStart,
  };
});
export const useRewards = () => useAppStore((state) => {
  if (!state.rewards) {
    console.warn('Rewards slice not initialized');
    return {
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      transactions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      unlockableApps: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
    };
  }
  return state.rewards;
});

export const useSocial = () => useAppStore((state) => {
  if (!state.social) {
    console.warn('Social slice not initialized');
    return {
      squads: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      challenges: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      friends: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      userSquads: [],
      activeChallenges: [],
    };
  }
  return state.social;
});

export const useSettings = () => useAppStore((state) => {
  if (!state.settings) {
    console.warn('Settings slice not initialized');
    return {
      settings: {
        theme: 'system' as const,
        language: 'en',
        notifications: {
          enabled: true,
          sessionReminders: true,
          breakReminders: true,
          dailyGoals: true,
          squadUpdates: true,
        },
        privacy: {
          shareStats: true,
          allowFriendRequests: true,
          showOnlineStatus: true,
        },
        focus: {
          defaultDuration: 25,
          breakDuration: 5,
          longBreakDuration: 15,
          sessionsUntilLongBreak: 4,
          soundEnabled: true,
          vibrationEnabled: true,
          autoStartBreaks: false,
          autoStartSessions: false,
        },
      },
    };
  }
  return state.settings;
});

export const useUI = () => useAppStore((state) => {
  if (!state || !state.ui) {
    if (__DEV__) {
      console.warn('UI slice not initialized, state:', state);
    }
    return {
      isHydrated: true, // Default to true to avoid blocking
      modals: {},
      loading: { global: false, actions: {} },
      errors: [],
      showModal: () => {},
      hideModal: () => {},
      setLoading: () => {},
      addError: () => {},
      clearError: () => {},
      clearAllErrors: () => {},
      isModalVisible: () => false,
      getModalData: () => null,
      isLoading: () => false,
      getErrors: () => [],
    };
  }
  return state.ui;
});

/**
 * Selective hooks for performance optimization
 */
export const useAuthUser = () => useAppStore((state) => state.auth.user);
export const useIsAuthenticated = () => useAppStore((state) => state.auth.isAuthenticated);
export const useCurrentSession = () => useAppStore((state) => state.focus.currentSession);
export const useIsSessionRunning = () => useAppStore((state) => state.focus.currentSession.isRunning);
export const useSeedsBalance = () => useAppStore((state) => state.rewards.balance);
export const useTheme = () => useAppStore((state) => state.settings.settings.theme);
export const useIsLoading = (action?: string) => useAppStore((state) => 
  action ? state.ui.loading.actions[action] || false : state.ui.loading.global
);

/**
 * Store actions hooks
 */
export const useAuthActions = () => useAppStore((state) => ({
  login: state.auth.login,
  logout: state.auth.logout,
  refreshAuth: state.auth.refreshAuth,
  updateProfile: state.auth.updateProfile,
}));

export const useFocusActions = () => useAppStore((state) => ({
  startSession: state.focus.startSession,
  pauseSession: state.focus.pauseSession,
  resumeSession: state.focus.resumeSession,
  completeSession: state.focus.completeSession,
  cancelSession: state.focus.cancelSession,
}));

export const useTasksActions = () => {
  return useAppStore((state) => {
    if (__DEV__) {
      console.log('useTasksActions called:', {
        hasStore: !!state,
        hasTasksSlice: !!state.tasks,
        hasSetSelectedDate: !!state.tasks?.setSelectedDate,
        setSelectedDateType: typeof state.tasks?.setSelectedDate,
        tasksSliceKeys: state.tasks ? Object.keys(state.tasks).filter(key => typeof (state.tasks as any)[key] === 'function') : 'no tasks slice',
        allTasksKeys: state.tasks ? Object.keys(state.tasks) : 'no tasks slice',
      });
    }
    
    if (!state.tasks) {
      console.warn('Tasks slice not available in useTasksActions');
      return {
        createTask: () => console.warn('createTask not available'),
        updateTask: () => console.warn('updateTask not available'),
        deleteTask: () => console.warn('deleteTask not available'),
        startTask: () => console.warn('startTask not available'),
        completeTask: () => console.warn('completeTask not available'),
        setSelectedDate: (date: Date) => {
          console.warn('setSelectedDate not available, received:', date);
        },
        setViewMode: () => console.warn('setViewMode not available'),
        goToPreviousWeek: () => console.warn('goToPreviousWeek not available'),
        goToNextWeek: () => console.warn('goToNextWeek not available'),
        goToCurrentWeek: () => console.warn('goToCurrentWeek not available'),
      };
    }
    
    // Return the actions directly from the state
    const actions = {
      createTask: state.tasks.createTask,
      updateTask: state.tasks.updateTask,
      deleteTask: state.tasks.deleteTask,
      startTask: state.tasks.startTask,
      completeTask: state.tasks.completeTask,
      setSelectedDate: state.tasks.setSelectedDate,
      setViewMode: state.tasks.setViewMode,
      goToPreviousWeek: state.tasks.goToPreviousWeek,
      goToNextWeek: state.tasks.goToNextWeek,
      goToCurrentWeek: state.tasks.goToCurrentWeek,
    };
    
    if (__DEV__) {
      console.log('useTasksActions returning:', {
        setSelectedDateType: typeof actions.setSelectedDate,
        allActionTypes: Object.keys(actions).map(key => `${key}: ${typeof actions[key as keyof typeof actions]}`),
      });
    }
    
    return actions;
  });
};

export const useRewardsActions = () => useAppStore((state) => ({
  earnSeeds: state.rewards.earnSeeds,
  spendSeeds: state.rewards.spendSeeds,
  unlockApp: state.rewards.unlockApp,
}));

export const useUIActions = () => useAppStore((state) => ({
  showModal: state.ui.showModal,
  hideModal: state.ui.hideModal,
  setLoading: state.ui.setLoading,
  addError: state.ui.addError,
  clearError: state.ui.clearError,
  clearAllErrors: state.ui.clearAllErrors,
}));

/**
 * Store selectors hooks
 */
export const useAuthSelectors = () => useAppStore((state) => {
  if (!state.auth) {
    console.warn('Auth slice not initialized');
    return {
      getUser: () => null,
      isLoggedIn: () => false,
    };
  }
  
  return {
    getUser: state.auth.getUser || (() => null),
    isLoggedIn: state.auth.isLoggedIn || (() => false),
  };
});

export const useFocusSelectors = () => useAppStore((state) => {
  if (!state.focus) {
    console.warn('Focus slice not initialized');
    return {
      getSessionById: () => undefined,
      getSessionsForDateRange: () => [],
      getCategoryById: () => undefined,
      getActiveSession: () => null,
      getChartData: () => [],
      getProductivityInsights: () => ({
        bestTimeOfDay: '',
        mostProductiveDay: '',
        averageSessionLength: 0,
        completionRate: 0,
        weeklyTrend: 'stable' as const,
        suggestions: [],
      }),
    };
  }
  
  return {
    getSessionById: state.focus.getSessionById || (() => undefined),
    getSessionsForDateRange: state.focus.getSessionsForDateRange || (() => []),
    getCategoryById: state.focus.getCategoryById || (() => undefined),
    getActiveSession: state.focus.getActiveSession || (() => null),
    getChartData: state.focus.getChartData || (() => []),
    getProductivityInsights: state.focus.getProductivityInsights || (() => ({
      bestTimeOfDay: '',
      mostProductiveDay: '',
      averageSessionLength: 0,
      completionRate: 0,
      weeklyTrend: 'stable' as const,
      suggestions: [],
    })),
  };
});

export const useTasksSelectors = () => useAppStore((state) => {
  // Ensure tasks slice is properly initialized
  if (!state.tasks) {
    console.warn('Tasks slice not initialized');
    return {
      getTaskById: () => undefined,
      getTasksForDate: () => [],
      getActiveTask: () => null,
      getTasksForDateRange: () => [],
      getTaskProgress: () => ({ completed: false, focusTimeSpent: 0, estimatedTime: 0, actualTime: 0 }),
    };
  }
  
  return {
    getTaskById: state.tasks.getTaskById || (() => undefined),
    getTasksForDate: state.tasks.getTasksForDate || (() => []),
    getActiveTask: state.tasks.getActiveTask || (() => null),
    getTasksForDateRange: state.tasks.getTasksForDateRange || (() => []),
    getTaskProgress: state.tasks.getTaskProgress || (() => ({ completed: false, focusTimeSpent: 0, estimatedTime: 0, actualTime: 0 })),
  };
});

/**
 * Store utilities
 */
export const getStoreState = () => useAppStore.getState();
export const subscribeToStore = useAppStore.subscribe;

/**
 * Event bus utilities
 */
export { storeEventBus, createEventEmitter, createEventListener };

/**
 * Store initialization
 */
export function initializeStore() {
  const state = getStoreState();
  
  // Initialize performance monitoring
  initializePerformanceMonitoring();
  
  // Initialize event listeners for cross-store communication
  setupCrossStoreEventListeners();
  
  // Log store initialization in development
  if (__DEV__) {
    console.log('🚀 Unified store initialized');
    console.log('Store state:', state);
  }
}

/**
 * Setup cross-store event listeners
 */
function setupCrossStoreEventListeners() {
  const eventListener = createEventListener();
  
  // Focus session completion -> Rewards
  eventListener.on('FOCUS_SESSION_COMPLETED', (event) => {
    const { sessionId, seedsEarned, duration } = event.payload;
    const state = getStoreState();
    
    if (seedsEarned > 0) {
      state.rewards.earnSeeds(seedsEarned, 'focus_session', {
        sessionId,
        duration,
      });
    }
  });
  
  // Task completion -> Rewards
  eventListener.on('TASK_COMPLETED', (event) => {
    const { taskId, focusTime } = event.payload;
    const state = getStoreState();
    
    // Calculate seeds based on focus time
    const seedsEarned = Math.floor(focusTime / 60) * 2; // 2 seeds per minute
    
    if (seedsEarned > 0) {
      state.rewards.earnSeeds(seedsEarned, 'task_completion', {
        taskId,
        focusTime,
      });
    }
  });
  
  // User logout -> Clear sensitive data
  eventListener.on('USER_LOGGED_OUT', () => {
    const state = getStoreState();
    
    // Clear sensitive data from all slices
    state.focus.sessions = createNormalizedState();
    state.tasks.tasks = createNormalizedState();
    state.rewards.balance = 0;
    state.rewards.totalEarned = 0;
    state.rewards.totalSpent = 0;
    state.rewards.transactions = createNormalizedState();
    state.social.squads = createNormalizedState();
    state.social.challenges = createNormalizedState();
    state.social.userSquads = [];
    state.social.activeChallenges = [];
  });
  
  // Settings theme change -> UI update
  eventListener.on('THEME_CHANGED', (event) => {
    const { theme } = event.payload;
    
    if (__DEV__) {
      console.log(`🎨 Theme changed to: ${theme}`);
    }
  });
}

/**
 * Store reset utility for testing
 */
export function resetStore() {
  const state = getStoreState();
  
  // Reset all slices to initial state
  Object.keys(state).forEach(key => {
    if (key !== 'ui') {
      // Reset slice while preserving structure
      const slice = state[key as keyof RootStore];
      if (typeof slice === 'object' && slice !== null) {
        Object.keys(slice).forEach(prop => {
          if (typeof slice[prop as keyof typeof slice] !== 'function') {
            // Reset data properties, keep functions
            delete slice[prop as keyof typeof slice];
          }
        });
      }
    }
  });
  
  // Clear event bus
  storeEventBus.removeAllListeners();
  storeEventBus.clearHistory();
  
  if (__DEV__) {
    console.log('🔄 Store reset completed');
  }
}

// Initialize store on module load
initializeStore();

// Export types for external use
export type { RootStore } from './types';
export { createNormalizedState } from './utils/entityManager';
export { STORE_EVENTS } from './utils/eventBus';

// Export performance utilities
export * from './performance';
export * from './selectors';
export * from './hooks';