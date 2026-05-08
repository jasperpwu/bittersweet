/**
 * Optimized persistence middleware
 * Addresses Requirements: 5.4, 7.1, 7.4, 8.1, 8.4, 8.5
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createJSONStorage } from 'zustand/middleware';

export const STORAGE_KEY = 'bittersweet-store';

// Optimized storage implementation with empty-state write guard
class OptimizedStorage {
  private batchWrites = new Map<string, string>();
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
      const raw = await AsyncStorage.getItem(name);

      // One-time migration: if storage has a non-zero version, it's from an old
      // format. Clear it so zustand starts fresh (no existing users to preserve).
      if (raw && name === STORAGE_KEY) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.version && parsed.version !== 0) {
            console.warn(`⚠️ Clearing legacy storage (version ${parsed.version} → 0)`);
            await AsyncStorage.removeItem(name);
            return null;
          }
        } catch {
          // Corrupted JSON — clear it
          console.warn('⚠️ Clearing corrupted storage');
          await AsyncStorage.removeItem(name);
          return null;
        }
      }

      return raw;
    } catch (error) {
      console.error('Storage getItem error:', error);
      // Re-throw so zustand's rehydration .catch() fires and onRehydrateStorage
      // receives the error. Returning null here would silently make zustand think
      // there's no persisted state, causing it to overwrite storage with defaults.
      throw error;
    }
  }

  async setItem(name: string, value: string): Promise<void> {
    // Empty-state write guard: prevent writing empty defaults over real data
    if (name === STORAGE_KEY) {
      const blocked = await this.isEmptyStateOverwrite(value);
      if (blocked) {
        console.warn('⚠️ BLOCKED: Attempted to write empty state over existing data. This prevents data loss.');
        return;
      }
    }

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

    // Capture writes BEFORE clearing so fallback can use them
    const writes: [string, string][] = [];
    this.batchWrites.forEach((value, key) => {
      writes.push([key, value]);
    });

    try {
      await AsyncStorage.multiSet(writes);
      // Only clear AFTER successful write
      this.batchWrites.clear();
    } catch (error) {
      console.error('Storage batch write error:', error);
      // Clear the batch since we captured writes above
      this.batchWrites.clear();
      // Fallback to individual writes using the captured array
      const promises: Promise<void>[] = [];
      for (const [key, value] of writes) {
        promises.push(
          AsyncStorage.setItem(key, value).catch((individualError) => {
            console.error(`Storage individual write error for ${key}:`, individualError);
          })
        );
      }
      await Promise.all(promises);
    }
  }

  /**
   * Checks if the proposed write is empty defaults that would overwrite real data.
   * Returns true if the write should be BLOCKED.
   */
  private async isEmptyStateOverwrite(newValue: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(newValue);
      // Extract the state object (zustand persist wraps it in { state, version })
      const newState = parsed?.state || parsed;

      // Check if the new state looks empty (no user data)
      const hasNoSessions = !newState?.focus?.sessions?.allIds?.length;
      const hasNoTags = !newState?.focus?.tags?.allNames?.length;
      const hasNoBalance = !newState?.rewards?.balance && !newState?.rewards?.totalEarned;

      if (!hasNoSessions || !hasNoTags || !hasNoBalance) {
        // New state has data, allow the write
        return false;
      }

      // New state appears empty — check if storage currently has real data
      const existing = await AsyncStorage.getItem(STORAGE_KEY);
      if (!existing) {
        // No existing data, allow writing empty state (first run)
        return false;
      }

      const existingParsed = JSON.parse(existing);
      const existingState = existingParsed?.state || existingParsed;

      const existingHasSessions = (existingState?.focus?.sessions?.allIds?.length || 0) > 0;
      const existingHasTags = (existingState?.focus?.tags?.allNames?.length || 0) > 0;
      const existingHasBalance = (existingState?.rewards?.balance || 0) > 0 || (existingState?.rewards?.totalEarned || 0) > 0;

      if (existingHasSessions || existingHasTags || existingHasBalance) {
        // Storage has real data but we're trying to write empty state — BLOCK
        return true;
      }

      return false;
    } catch {
      // If we can't parse, allow the write (don't block on errors)
      return false;
    }
  }
}

// Create optimized storage instance
const optimizedStorage = new OptimizedStorage();

// Persistence configuration with selective persistence
export const persistenceConfig = {
  name: STORAGE_KEY,
  storage: createJSONStorage(() => optimizedStorage),
  // version 0 (zustand default) — no migrations needed, no version-mismatch nuke

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
          tags: { byName: {}, allNames: [], loading: false, error: null, lastUpdated: null },
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

  // Merge function for handling conflicts — does NOT mutate currentState
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

    // Build a new merged object without mutating currentState
    const merged: any = { ...currentState };

    try {
      Object.keys(persistedState).forEach(sliceKey => {
        const persistedSlice = persistedState[sliceKey];
        const currentSlice = currentState[sliceKey];

        if (persistedSlice && currentSlice && typeof persistedSlice === 'object') {
          // Create a NEW slice object — never mutate currentSlice
          const mergedSlice = { ...currentSlice };

          Object.keys(persistedSlice).forEach(key => {
            const persistedValue = persistedSlice[key];
            const currentValue = currentSlice[key];

            // Only merge non-function properties
            if (typeof currentValue !== 'function' && typeof persistedValue !== 'function') {
              mergedSlice[key] = persistedValue;
            }
          });

          merged[sliceKey] = mergedSlice;
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
  STORAGE_KEY,
};
