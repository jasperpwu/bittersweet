/**
 * Optimized persistence middleware with versioning support
 * Addresses Requirements: 5.4, 7.1, 7.4, 8.1, 8.4, 8.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, persist, PersistOptions } from 'zustand/middleware';
import { RootStore } from '../types';

// Storage version for migration support
export const STORAGE_VERSION = 2;
export const STORAGE_KEY = 'bittersweet-store';

// Migration functions for different versions
const migrations = {
  1: (state: any) => {
    // Migration from version 0 to 1
    console.log('🔄 Migrating store from version 0 to 1');
    
    // Handle legacy homeSlice data
    if (state.homeSlice) {
      const { user, tasks, dailyGoals, ...rest } = state.homeSlice;
      
      // Migrate user data to auth slice
      if (user) {
        state.auth = {
          ...state.auth,
          user: {
            id: user.id || 'user-1',
            email: user.email || '',
            name: user.name || 'User',
            avatar: user.avatar,
            preferences: user.preferences || {},
            stats: user.stats || {
              totalFocusTime: 0,
              totalSessions: 0,
              currentStreak: 0,
              longestStreak: 0,
              seedsEarned: 0,
              level: 1,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          isAuthenticated: true,
        };
      }
      
      // Migrate tasks data to tasks slice
      if (tasks && Array.isArray(tasks)) {
        const tasksById: Record<string, any> = {};
        const taskIds: string[] = [];
        
        tasks.forEach((task: any) => {
          const taskId = task.id || `task-${Date.now()}-${Math.random()}`;
          tasksById[taskId] = {
            ...task,
            id: taskId,
            createdAt: task.createdAt || new Date(),
            updatedAt: task.updatedAt || new Date(),
          };
          taskIds.push(taskId);
        });
        
        state.tasks = {
          ...state.tasks,
          tasks: {
            byId: tasksById,
            allIds: taskIds,
            loading: false,
            error: null,
            lastUpdated: new Date(),
          },
        };
      }
      
      // Remove legacy homeSlice
      delete state.homeSlice;
    }
    
    return state;
  },
  
  2: (state: any) => {
    // Migration from version 1 to 2
    console.log('🔄 Migrating store from version 1 to 2');
    
    // Add new fields introduced in version 2
    if (state.focus && !state.focus.stats) {
      state.focus.stats = {
        totalSessions: 0,
        totalFocusTime: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageSessionLength: 0,
        completionRate: 0,
      };
    }
    
    // Ensure all slices have proper normalized structure
    const slices = ['focus', 'tasks', 'rewards', 'social'];
    slices.forEach(sliceName => {
      if (state[sliceName]) {
        Object.keys(state[sliceName]).forEach(key => {
          if (key.endsWith('s') && Array.isArray(state[sliceName][key])) {
            // Convert array to normalized structure
            const items = state[sliceName][key];
            const byId: Record<string, any> = {};
            const allIds: string[] = [];
            
            items.forEach((item: any) => {
              if (item.id) {
                byId[item.id] = item;
                allIds.push(item.id);
              }
            });
            
            state[sliceName][key] = {
              byId,
              allIds,
              loading: false,
              error: null,
              lastUpdated: new Date(),
            };
          }
        });
      }
    });
    
    return state;
  },
};

// Optimized storage implementation
class OptimizedStorage {
  private compressionEnabled = true;
  private batchWrites = new Map<string, any>();
  private batchTimeout: NodeJS.Timeout | null = null;
  
  async getItem(name: string): Promise<string | null> {
    try {
      const item = await AsyncStorage.getItem(name);
      
      if (item && this.compressionEnabled) {
        // Simple compression detection and decompression could be added here
        return item;
      }
      
      return item;
    } catch (error) {
      console.error('Storage getItem error:', error);
      return null;
    }
  }
  
  async setItem(name: string, value: string): Promise<void> {
    // Batch writes to improve performance
    this.batchWrites.set(name, value);
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = setTimeout(async () => {
      await this.flushBatchWrites();
    }, 100); // Batch writes for 100ms
  }
  
  async removeItem(name: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      console.error('Storage removeItem error:', error);
    }
  }
  
  private async flushBatchWrites(): Promise<void> {
    if (this.batchWrites.size === 0) return;
    
    try {
      const writes = Array.from(this.batchWrites.entries());
      await AsyncStorage.multiSet(writes);
      this.batchWrites.clear();
    } catch (error) {
      console.error('Storage batch write error:', error);
      // Fallback to individual writes
      for (const [key, value] of this.batchWrites.entries()) {
        try {
          await AsyncStorage.setItem(key, value);
        } catch (individualError) {
          console.error(`Storage individual write error for ${key}:`, individualError);
        }
      }
      this.batchWrites.clear();
    }
  }
}

// Create optimized storage instance
const optimizedStorage = new OptimizedStorage();

// Persistence configuration with selective persistence and versioning
export const persistenceConfig: PersistOptions<RootStore> = {
  name: STORAGE_KEY,
  storage: createJSONStorage(() => optimizedStorage),
  version: STORAGE_VERSION,
  
  // Selective persistence - only persist necessary data
  partialize: (state: RootStore) => ({
    auth: {
      user: state.auth.user,
      authToken: state.auth.authToken,
      refreshToken: state.auth.refreshToken,
      isAuthenticated: state.auth.isAuthenticated,
    },
    focus: {
      sessions: state.focus.sessions,
      categories: state.focus.categories,
      tags: state.focus.tags,
      settings: state.focus.settings,
      stats: state.focus.stats,
    },
    tasks: {
      tasks: state.tasks.tasks,
      selectedDate: state.tasks.selectedDate,
      viewMode: state.tasks.viewMode,
    },
    rewards: {
      balance: state.rewards.balance,
      totalEarned: state.rewards.totalEarned,
      totalSpent: state.rewards.totalSpent,
      transactions: state.rewards.transactions,
      unlockableApps: state.rewards.unlockableApps,
    },
    social: {
      squads: state.social.squads,
      challenges: state.social.challenges,
      userSquads: state.social.userSquads,
      activeChallenges: state.social.activeChallenges,
    },
    settings: state.settings,
    // UI state is intentionally not persisted
  }),
  
  // Migration function
  migrate: (persistedState: any, version: number) => {
    console.log(`🔄 Migrating store from version ${version} to ${STORAGE_VERSION}`);
    
    let migratedState = persistedState;
    
    // Apply migrations sequentially
    for (let v = version + 1; v <= STORAGE_VERSION; v++) {
      if (migrations[v as keyof typeof migrations]) {
        migratedState = migrations[v as keyof typeof migrations](migratedState);
      }
    }
    
    console.log('✅ Store migration completed');
    return migratedState;
  },
  
  // Hydration callback
  onRehydrateStorage: () => (state, error) => {
    if (error) {
      console.error('❌ Store rehydration error:', error);
      // Could implement error recovery here
      return;
    }
    
    if (state) {
      console.log('✅ Store rehydrated successfully');
      
      // Ensure all required fields are present and valid
      if (!state.tasks) {
        console.warn('Tasks slice missing after rehydration, initializing...');
        state.tasks = {
          tasks: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
          selectedDate: new Date(),
          viewMode: 'day' as const,
          currentWeekStart: (() => {
            const today = new Date();
            const currentDay = today.getDay();
            const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - daysFromMonday);
            weekStart.setHours(0, 0, 0, 0);
            return weekStart;
          })(),
        };
      }
      
      // Ensure selectedDate is a valid Date object
      if (state.tasks.selectedDate && !(state.tasks.selectedDate instanceof Date)) {
        state.tasks.selectedDate = new Date(state.tasks.selectedDate);
      }
      
      // Ensure currentWeekStart is a valid Date object
      if (state.tasks.currentWeekStart && !(state.tasks.currentWeekStart instanceof Date)) {
        state.tasks.currentWeekStart = new Date(state.tasks.currentWeekStart);
      }
      
      // Verify that all action functions are still available after rehydration
      if (__DEV__) {
        const requiredActions = ['setSelectedDate', 'setViewMode', 'goToPreviousWeek', 'goToNextWeek'];
        const missingActions = requiredActions.filter(action => typeof state.tasks[action] !== 'function');
        if (missingActions.length > 0) {
          console.error('❌ Missing task actions after rehydration:', missingActions);
        } else {
          console.log('✅ All task actions preserved after rehydration');
        }
      }
      
      // Mark as hydrated
      if (state.ui) {
        state.ui.isHydrated = true;
      }
      
      // Perform post-hydration setup
      setupPostHydration(state);
    }
  },
  
  // Skip hydration for certain conditions
  skipHydration: false,
  
  // Merge function for handling conflicts
  merge: (persistedState, currentState) => {
    // Custom merge logic to handle conflicts
    // IMPORTANT: Only merge data, preserve all functions from currentState
    const merged = { ...currentState };
    
    // Merge only data properties, not functions
    Object.keys(persistedState).forEach(sliceKey => {
      if (sliceKey === 'ui') {
        // UI state is never persisted
        return;
      }
      
      const persistedSlice = persistedState[sliceKey];
      const currentSlice = currentState[sliceKey];
      
      if (persistedSlice && currentSlice && typeof persistedSlice === 'object') {
        // Merge data properties while preserving functions
        Object.keys(persistedSlice).forEach(key => {
          const persistedValue = persistedSlice[key];
          const currentValue = currentSlice[key];
          
          // Only merge non-function properties
          if (typeof currentValue !== 'function' && typeof persistedValue !== 'function') {
            currentSlice[key] = persistedValue;
          }
        });
      }
    });
    
    // Validate data integrity
    validateStateIntegrity(merged);
    
    return merged;
  },
};

// Post-hydration setup
function setupPostHydration(state: RootStore) {
  // Recalculate computed values that might be stale
  if (state.focus.sessions.allIds.length > 0) {
    // Recalculate focus stats
    const sessions = state.focus.sessions.allIds.map(id => state.focus.sessions.byId[id]);
    const completedSessions = sessions.filter(s => s.status === 'completed');
    
    state.focus.stats = {
      totalSessions: completedSessions.length,
      totalFocusTime: completedSessions.reduce((total, s) => total + s.duration, 0),
      currentStreak: calculateCurrentStreak(completedSessions),
      longestStreak: calculateLongestStreak(completedSessions),
      averageSessionLength: completedSessions.length > 0 
        ? completedSessions.reduce((total, s) => total + s.duration, 0) / completedSessions.length 
        : 0,
      completionRate: sessions.length > 0 
        ? (completedSessions.length / sessions.length) * 100 
        : 0,
    };
  }
  
  // Clean up expired data
  cleanupExpiredData(state);
  
  // Initialize event listeners
  setupEventListeners();
}

// Validate state integrity after hydration
function validateStateIntegrity(state: any) {
  const issues: string[] = [];
  
  // Check for required fields
  if (!state.auth) issues.push('Missing auth slice');
  if (!state.focus) issues.push('Missing focus slice');
  if (!state.tasks) issues.push('Missing tasks slice');
  if (!state.rewards) issues.push('Missing rewards slice');
  if (!state.social) issues.push('Missing social slice');
  if (!state.settings) issues.push('Missing settings slice');
  if (!state.ui) issues.push('Missing ui slice');
  
  // Check normalized structures
  const normalizedSlices = ['focus', 'tasks', 'rewards', 'social'];
  normalizedSlices.forEach(sliceName => {
    if (state[sliceName]) {
      Object.keys(state[sliceName]).forEach(key => {
        const value = state[sliceName][key];
        if (value && typeof value === 'object' && 'byId' in value) {
          if (!value.allIds || !Array.isArray(value.allIds)) {
            issues.push(`Invalid normalized structure in ${sliceName}.${key}: missing allIds`);
          }
          if (!value.byId || typeof value.byId !== 'object') {
            issues.push(`Invalid normalized structure in ${sliceName}.${key}: missing byId`);
          }
        }
      });
    }
  });
  
  if (issues.length > 0) {
    console.warn('⚠️ State integrity issues found:', issues);
    // Could implement automatic fixes here
  }
}

// Helper functions for stats calculation
function calculateCurrentStreak(sessions: any[]): number {
  if (sessions.length === 0) return 0;
  
  const sortedSessions = sessions
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  for (const session of sortedSessions) {
    const sessionDate = new Date(session.startTime);
    sessionDate.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.floor((currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === streak) {
      streak++;
    } else if (daysDiff > streak) {
      break;
    }
  }
  
  return streak;
}

function calculateLongestStreak(sessions: any[]): number {
  if (sessions.length === 0) return 0;
  
  const sessionDates = sessions
    .map(s => {
      const date = new Date(s.startTime);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    })
    .filter((date, index, arr) => arr.indexOf(date) === index)
    .sort((a, b) => a - b);
  
  let longestStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < sessionDates.length; i++) {
    const daysDiff = (sessionDates[i] - sessionDates[i - 1]) / (1000 * 60 * 60 * 24);
    
    if (daysDiff === 1) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  return longestStreak;
}

// Clean up expired data
function cleanupExpiredData(state: RootStore) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Clean up old error logs
  if (state.ui.errors.length > 0) {
    state.ui.errors = state.ui.errors.filter(
      error => new Date(error.timestamp) > thirtyDaysAgo
    );
  }
  
  // Clean up old transactions (keep last 100)
  if (state.rewards.transactions.allIds.length > 100) {
    const sortedIds = state.rewards.transactions.allIds
      .map(id => ({
        id,
        timestamp: state.rewards.transactions.byId[id].timestamp,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100)
      .map(item => item.id);
    
    const newById: Record<string, any> = {};
    sortedIds.forEach(id => {
      newById[id] = state.rewards.transactions.byId[id];
    });
    
    state.rewards.transactions = {
      ...state.rewards.transactions,
      byId: newById,
      allIds: sortedIds,
    };
  }
}

// Setup event listeners for persistence optimization
function setupEventListeners() {
  // Listen for app state changes to optimize persistence
  // This would be implemented with react-native's AppState
}

// Export utilities for testing and debugging
export const persistenceUtils = {
  validateStateIntegrity,
  calculateCurrentStreak,
  calculateLongestStreak,
  cleanupExpiredData,
  STORAGE_VERSION,
  STORAGE_KEY,
};