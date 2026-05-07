/**
 * Optimized persistence middleware with versioning support
 * Addresses Requirements: 5.4, 7.1, 7.4, 8.1, 8.4, 8.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createJSONStorage } from 'zustand/middleware';

export const STORAGE_VERSION = 1;
export const STORAGE_KEY = 'bittersweet-store';

// Optimized storage implementation
class OptimizedStorage {
  private batchWrites = new Map<string, any>();
  private batchTimeout: NodeJS.Timeout | null = null;
  private firstWriteTime: number | null = null;
  private static readonly DEBOUNCE_MS = 100;
  private static readonly MAX_DELAY_MS = 2000;

  constructor() {
    AppState.addEventListener('change', (nextState) => {
      // Flush when going to background (prevent loss on suspend)
      // and when returning to active (recover after crash/force-kill)
      if (nextState === 'background' || nextState === 'inactive' || nextState === 'active') {
        this.flushBatchWrites();
      }
    });
  }

  async getItem(name: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(name);
    } catch (error) {
      console.error('Storage getItem error:', error);
      // Re-throw so zustand's rehydration .catch() fires and onRehydrateStorage
      // receives the error. Returning null here would silently make zustand think
      // there's no persisted state, causing it to overwrite storage with defaults.
      throw error;
    }
  }

  async setItem(name: string, value: string): Promise<void> {
    this.batchWrites.set(name, value);

    // Track when the first write in this batch was queued
    if (this.firstWriteTime === null) {
      this.firstWriteTime = Date.now();
    }

    // If we've been deferring writes for too long, flush immediately
    if (Date.now() - this.firstWriteTime >= OptimizedStorage.MAX_DELAY_MS) {
      await this.flushBatchWrites();
      return;
    }

    // Otherwise reset the debounce timer
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(async () => {
      await this.flushBatchWrites();
    }, OptimizedStorage.DEBOUNCE_MS);
  }

  async removeItem(name: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(name);
    } catch (error) {
      console.error('Storage removeItem error:', error);
    }
  }

  async flushBatchWrites(): Promise<void> {
    if (this.batchWrites.size === 0) return;

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    this.firstWriteTime = null;

    try {
      const writes: [string, string][] = [];
      this.batchWrites.forEach((value, key) => {
        writes.push([key, value]);
      });
      this.batchWrites.clear();
      await AsyncStorage.multiSet(writes);
    } catch (error) {
      console.error('Storage batch write error:', error);
      // Fallback to individual writes
      const promises: Promise<void>[] = [];
      this.batchWrites.forEach((value, key) => {
        promises.push(
          AsyncStorage.setItem(key, value).catch((individualError) => {
            console.error(`Storage individual write error for ${key}:`, individualError);
          })
        );
      });
      await Promise.all(promises);
      this.batchWrites.clear();
    }
  }
}

// Create optimized storage instance
const optimizedStorage = new OptimizedStorage();

// Persistence configuration with selective persistence and versioning
export const persistenceConfig = {
  name: STORAGE_KEY,
  storage: createJSONStorage(() => optimizedStorage),
  version: STORAGE_VERSION,
  
  // Selective persistence - only persist necessary data
  partialize: (state: any) => ({
    focus: {
      sessions: state.focus.sessions,
      tags: state.focus.tags,
      goals: state.focus.goals,
      currentSession: state.focus.currentSession,
      selectedDate: state.focus.selectedDate,
      viewMode: state.focus.viewMode,
      currentWeekStart: state.focus.currentWeekStart,
      settings: state.focus.settings,
    },
    rewards: {
      balance: state.rewards.balance,
      totalEarned: state.rewards.totalEarned,
      totalSpent: state.rewards.totalSpent,
      transactions: state.rewards.transactions,
      unlockableApps: state.rewards.unlockableApps,
    },
    blocklist: {
      settings: state.blocklist.settings,
      currentSelectionId: state.blocklist.currentSelectionId,
      activeSessions: state.blocklist.activeSessions,
      isAuthorized: state.blocklist.isAuthorized,
      authorizationStatus: state.blocklist.authorizationStatus,
    },
    settings: state.settings,
  }),
  
  // Hydration callback
  onRehydrateStorage: () => (state: any, error: any) => {
    if (error) {
      console.error('❌ Store rehydration error:', error);
      // Do NOT delete storage here — the data may still be valid on next launch.
      // Deleting causes permanent data loss for transient errors (memory pressure, etc.)
      return;
    }

    if (state) {
      console.log('✅ Store rehydrated successfully');
      
      // Restore focus slice
      if (!state.focus) {
        console.warn('Focus slice missing after rehydration, initializing...');
        state.focus = {
          sessions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
          tags: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
          currentSession: { session: null, isRunning: false, remainingTime: 0, startedAt: null },
          selectedDate: new Date(),
          viewMode: 'day',
          currentWeekStart: (() => {
            const today = new Date();
            const currentDay = today.getDay();
            const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - daysFromMonday);
            weekStart.setHours(0, 0, 0, 0);
            return weekStart;
          })(),
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
      
      // Restore rewards slice if missing
      if (!state.rewards) {
        console.warn('Rewards slice missing after rehydration, initializing...');
        state.rewards = {
          balance: 0,
          totalEarned: 0,
          totalSpent: 0,
          transactions: [],
          unlockableApps: [],
        };
      }

      // Restore blocklist slice if missing
      if (!state.blocklist) {
        console.warn('Blocklist slice missing after rehydration, initializing...');
        state.blocklist = {
          settings: {
            blockedApps: { applicationTokens: [], categoryTokens: [], webDomainTokens: [] },
            unlockCostPerMinute: 1,
            scheduleEnabled: false,
          },
          currentSelectionId: null,
          activeSessions: { byId: {}, allIds: [] },
          isAuthorized: false,
          authorizationStatus: 0,
        };
      }

      // Restore dates in focus
      if (state.focus.selectedDate && !(state.focus.selectedDate instanceof Date)) {
        state.focus.selectedDate = new Date(state.focus.selectedDate);
      }
      
      if (state.focus.currentWeekStart && !(state.focus.currentWeekStart instanceof Date)) {
        state.focus.currentWeekStart = new Date(state.focus.currentWeekStart);
      }

      // Restore dates in persisted unlock sessions so expiration checks work
      if (state.blocklist?.activeSessions?.byId) {
        Object.values(state.blocklist.activeSessions.byId).forEach((session: any) => {
          if (session.startTime && !(session.startTime instanceof Date)) {
            session.startTime = new Date(session.startTime);
          }
          if (session.endTime && !(session.endTime instanceof Date)) {
            session.endTime = new Date(session.endTime);
          }
        });
      }

      // Mark as hydrated
      if (state.ui) {
        state.ui.isHydrated = true;
      }
    }
  },
  
  // Skip hydration for certain conditions
  skipHydration: false,
  
  // Merge function for handling conflicts
  merge: (persistedState: any, currentState: any) => {
    // Safety checks
    if (!persistedState || typeof persistedState !== 'object') {
      console.warn('Invalid persisted state, using current state');
      return currentState;
    }

    if (!currentState || typeof currentState !== 'object') {
      console.warn('Invalid current state, using persisted state');
      return persistedState;
    }

    // Custom merge logic to handle conflicts
    // IMPORTANT: Only merge data, preserve all functions from currentState
    const merged = { ...currentState };

    try {
      // Merge only data properties, not functions
      Object.keys(persistedState).forEach(sliceKey => {
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
    } catch (error) {
      console.error('❌ Error during state merge:', error);
      // Return persisted state merged shallowly rather than losing all data
      return { ...currentState, ...persistedState };
    }

    // Validate data integrity (non-fatal — logs warnings but doesn't discard data)
    validateStateIntegrity(merged);

    return merged;
  },
};

// Validate state integrity after hydration (non-throwing — logs warnings only)
function validateStateIntegrity(state: any) {
  if (!state || typeof state !== 'object') {
    console.warn('⚠️ State is not a valid object');
    return;
  }

  const issues: string[] = [];

  // Check for required fields
  if (!state.focus) issues.push('Missing focus slice');
  if (!state.rewards) issues.push('Missing rewards slice');
  if (!state.settings) issues.push('Missing settings slice');
  if (!state.ui) issues.push('Missing ui slice');

  // Check normalized structures
  const normalizedSlices = ['focus', 'rewards'];
  normalizedSlices.forEach(sliceName => {
    if (state[sliceName] && typeof state[sliceName] === 'object') {
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
  }
}

// Export utilities for testing and debugging
export const persistenceUtils = {
  validateStateIntegrity,
  STORAGE_VERSION,
  STORAGE_KEY,
};
