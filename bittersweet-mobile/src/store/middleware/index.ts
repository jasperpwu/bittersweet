/**
 * Core middleware implementations for unified Zustand store
 * Addresses Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { RootStore, StoreError, PersistConfig, DevtoolsConfig } from '../types';

/**
 * Performance monitoring middleware
 * Tracks state update performance and warns about slow operations
 */
export const performanceMiddleware = <T>(config: any) => (set: any, get: any, api: any) => {
  const originalSet = set;
  
  return config(
    (...args: any[]) => {
      const start = performance.now();
      const result = originalSet(...args);
      const end = performance.now();
      
      const duration = end - start;
      
      // Warn about slow state updates in development
      if (__DEV__ && duration > 16) {
        console.warn(`🐌 Slow state update detected: ${duration.toFixed(2)}ms`);
        console.trace('State update trace');
      }
      
      // Log performance metrics
      if (__DEV__ && duration > 5) {
        console.log(`⚡ State update: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    },
    get,
    api
  );
};

/**
 * Error handling middleware
 * Catches and handles errors during state updates
 */
export const errorHandlingMiddleware = <T extends { ui: { addError: (error: StoreError) => void } }>(
  config: any
) => (set: any, get: any, api: any) => {
  return config(
    (partial: any, replace?: boolean) => {
      try {
        return set(partial, replace);
      } catch (error) {
        const storeError: StoreError = {
          code: 'STATE_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown state update error',
          details: error,
          timestamp: new Date(),
          recoverable: true,
        };
        
        // Log error in development
        if (__DEV__) {
          console.error('🚨 Store Error:', storeError);
          console.trace('Error trace');
        }
        
        // Add error to UI state if available
        try {
          const state = get();
          if (state?.ui?.addError) {
            state.ui.addError(storeError);
          }
        } catch (uiError) {
          console.error('Failed to add error to UI state:', uiError);
        }
        
        // Re-throw the original error
        throw error;
      }
    },
    get,
    api
  );
};

/**
 * Logging middleware for development
 * Logs all state changes in development mode
 */
export const loggingMiddleware = <T>(config: any) => (set: any, get: any, api: any) => {
  if (!__DEV__) {
    return config(set, get, api);
  }

  const originalSet = set;
  
  return config(
    (partial: any, replace?: boolean, action?: string) => {
      const prevState = get();
      const result = originalSet(partial, replace);
      const nextState = get();
      
      // Log state changes
      console.group(`🔄 State Update${action ? ` - ${action}` : ''}`);
      console.log('Previous State:', prevState);
      console.log('Partial Update:', partial);
      console.log('Next State:', nextState);
      console.groupEnd();
      
      return result;
    },
    get,
    api
  );
};

/**
 * Create persistence configuration
 */
export function createPersistenceConfig(): PersistConfig {
  return {
    name: 'bittersweet-store',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state: RootStore) => ({
      focus: {
        sessions: state.focus.sessions,
        tags: state.focus.tags,
        settings: state.focus.settings,
        selectedDate: state.focus.selectedDate,
        viewMode: state.focus.viewMode,
      } as Partial<typeof state.focus>,
      rewards: {
        balance: state.rewards.balance,
        totalEarned: state.rewards.totalEarned,
        totalSpent: state.rewards.totalSpent,
        transactions: state.rewards.transactions,
        unlockableApps: state.rewards.unlockableApps,
      } as Partial<typeof state.rewards>,
      settings: state.settings,
      // UI state is not persisted
    } as Partial<RootStore>),
    version: 1,
    migrate: (persistedState: any, version: number) => {
      if (version === 0) {
        // Migration from legacy store structure
        return migrateLegacyStore(persistedState);
      }
      
      // Restore Date objects from strings
      if (persistedState) {
        // Restore selectedDate as Date object
        if (persistedState.focus?.selectedDate) {
          persistedState.focus.selectedDate = new Date(persistedState.focus.selectedDate);
        }
        
        // Restore dates in focus
        if (persistedState.focus?.currentWeekStart) {
          persistedState.focus.currentWeekStart = new Date(persistedState.focus.currentWeekStart);
        }
        
        // Restore dates in focus sessions
        if (persistedState.focus?.sessions?.byId) {
          Object.values(persistedState.focus.sessions.byId).forEach((session: any) => {
            if (session.startTime) session.startTime = new Date(session.startTime);
            if (session.endTime) session.endTime = new Date(session.endTime);
            if (session.createdAt) session.createdAt = new Date(session.createdAt);
            if (session.updatedAt) session.updatedAt = new Date(session.updatedAt);
          });
        }
        
        // Restore dates in tasks
        if (persistedState.tasks?.tasks?.byId) {
          Object.values(persistedState.tasks.tasks.byId).forEach((task: any) => {
            if (task.date) task.date = new Date(task.date);
            if (task.startTime) task.startTime = new Date(task.startTime);
            if (task.createdAt) task.createdAt = new Date(task.createdAt);
            if (task.updatedAt) task.updatedAt = new Date(task.updatedAt);
            if (task.progress?.completedAt) task.progress.completedAt = new Date(task.progress.completedAt);
          });
        }
      }
      
      return persistedState;
    },
    onRehydrateStorage: () => (state) => {
      if (state) {
        // Mark store as hydrated
        state.ui.isHydrated = true;
        
        // Ensure selectedDate is always a Date object
        if (state.focus && (!state.focus.selectedDate || !(state.focus.selectedDate instanceof Date))) {
          state.focus.selectedDate = new Date();
          console.log('🔧 Fixed selectedDate to be a Date object');
        }
        
        console.log('✅ Store rehydrated successfully');
      }
    },
  };
}

/**
 * Create devtools configuration
 */
export function createDevtoolsConfig(): DevtoolsConfig {
  return {
    name: 'bittersweet-store',
    enabled: __DEV__,
    serialize: {
      options: {
        date: true,
        function: true,
        undefined: true,
      },
    },
    actionSanitizer: (action: any) => {
      // Sanitize sensitive data in development
      return action;
    },
  };
}

/**
 * Migrate legacy store data
 */
function migrateLegacyStore(persistedState: any): any {
  console.log('🔄 Migrating legacy store data...');
  
  try {
    // Handle migration from old store structure
    const migratedState: any = {};
    
    // Migrate focus data if it exists
    if (persistedState.focus) {
      migratedState.focus = {
        sessions: persistedState.focus.sessions || { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        tags: persistedState.focus.tags || { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        currentSession: persistedState.focus.currentSession || { session: null, isRunning: false, remainingTime: 0, startedAt: null },
        selectedDate: persistedState.focus.selectedDate || new Date(),
        viewMode: persistedState.focus.viewMode || 'day',
        currentWeekStart: persistedState.focus.currentWeekStart || new Date(),
        settings: persistedState.focus.settings || {
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
    
    // Migrate tasks data if it exists
    if (persistedState.tasks) {
      migratedState.tasks = {
        tasks: persistedState.tasks.tasks || { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        selectedDate: persistedState.tasks.selectedDate || new Date(),
        viewMode: persistedState.tasks.viewMode || 'day',
      };
    }
    
    console.log('✅ Legacy store migration completed');
    return migratedState;
  } catch (error) {
    console.error('❌ Legacy store migration failed:', error);
    return {};
  }
}

/**
 * Create async action helper with error handling
 */
export function createAsyncAction<T, P>(
  actionName: string,
  asyncFn: (params: P) => Promise<T>
) {
  return async (params: P, { set, get }: { set: any; get: any }) => {
    const stateKey = `${actionName}State`;
    
    // Set loading state
    set((state: any) => {
      if (state[stateKey]) {
        state[stateKey].loading = true;
        state[stateKey].error = null;
      }
    });
    
    try {
      const result = await asyncFn(params);
      
      // Set success state
      set((state: any) => {
        if (state[stateKey]) {
          state[stateKey].loading = false;
          state[stateKey].data = result;
          state[stateKey].lastFetch = new Date();
        }
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Set error state
      set((state: any) => {
        if (state[stateKey]) {
          state[stateKey].loading = false;
          state[stateKey].error = errorMessage;
        }
      });
      
      throw error;
    }
  };
}

/**
 * Combine all middleware for the store
 */
export function createStoreMiddleware() {
  return {
    persist: createPersistenceConfig(),
    devtools: createDevtoolsConfig(),
    performance: performanceMiddleware,
    errorHandling: errorHandlingMiddleware,
    logging: loggingMiddleware,
    immer,
  };
}