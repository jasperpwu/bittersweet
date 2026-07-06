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

      // Validate JSON is parseable; clear if corrupted
      if (raw && name === STORAGE_KEY) {
        try {
          JSON.parse(raw);
        } catch {
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
      const hasNoTags = !newState?.focus?.tags?.allIds?.length;
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
      const existingHasTags = (existingState?.focus?.tags?.allIds?.length || 0) > 0;
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
  version: 9,
  migrate: (persistedState: any, version: number) => {
    if (version < 2) {
      console.log('🔄 Migrating store to v2 (adding auth slice)...');
      const state = persistedState;
      if (!state.auth) {
        state.auth = {
          user: null,
          isAuthenticated: false,
        };
      }
      console.log('✅ Store migration to v2 complete');
    }

    if (version < 3) {
      console.log('🔄 Migrating store to v3 (goal target history + rest days)...');
      const state = persistedState;
      if (state?.focus?.goals?.byId) {
        for (const goalId of Object.keys(state.focus.goals.byId)) {
          const goal = state.focus.goals.byId[goalId];
          if (!goal) continue;

          // Set restDayTargetMinutes to same as targetMinutes for existing goals
          if (goal.restDayTargetMinutes === undefined) {
            goal.restDayTargetMinutes = goal.targetMinutes;
          }

          // Initialize targetHistory with one entry
          if (!goal.targetHistory || !Array.isArray(goal.targetHistory)) {
            const effectiveDate = goal.createdAt
              ? new Date(goal.createdAt).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0];
            goal.targetHistory = [{
              effectiveDate,
              targetMinutes: goal.targetMinutes,
              restDayTargetMinutes: goal.targetMinutes,
              restDays: [0, 6], // default rest days at migration time
            }];
          }
        }
      }
      console.log('✅ Store migration to v3 complete');
    }

    if (version < 4) {
      console.log('🔄 Migrating store to v4 (goal model refactor: tagIds→tagId, per-period targets, badges)...');
      const state = persistedState;

      if (state?.focus?.goals?.byId) {
        const oldGoals = state.focus.goals.byId;
        const oldAllIds = state.focus.goals.allIds || Object.keys(oldGoals);
        const newById: Record<string, any> = {};
        const newAllIds: string[] = [];

        for (const goalId of oldAllIds) {
          const goal = oldGoals[goalId];
          if (!goal) continue;

          const tagIds: string[] = goal.tagIds || [];

          // Drop goals with no tags (they targeted "all tags" which no longer makes sense)
          if (tagIds.length === 0) continue;

          // Split goals with multiple tags into one goal per tag
          const tagsToProcess = tagIds.length >= 1 ? tagIds : [tagIds[0]];

          for (let i = 0; i < tagsToProcess.length; i++) {
            const tagId = tagsToProcess[i];
            const newId = i === 0 ? goalId : `${goalId}-split-${i}`;
            const oldPeriod = (goal.period as string) === 'yearly' ? 'monthly' : (goal.period || 'daily');
            const targetMinutes = goal.targetMinutes || 0;
            const restDayTargetMinutes = goal.restDayTargetMinutes ?? targetMinutes;

            // Map old targetHistory entries: add period field
            const oldHistory = goal.targetHistory || [];
            const newHistory = oldHistory.map((entry: any) => ({
              ...entry,
              period: oldPeriod,
            }));

            // Determine customName: if it matches auto-generated pattern, leave empty
            let customName: string | undefined = goal.name;
            if (customName) {
              // Check common auto-name patterns
              const autoPatterns = ['Focus Goal', 'Goal'];
              const isAuto = autoPatterns.some(p => customName === p) ||
                /^(Daily|Weekly|Monthly)\s+\w+\s+Goal$/.test(customName) ||
                /^\w+\s+Goal$/.test(customName);
              if (isAuto) customName = undefined;
            }

            const newGoal = {
              ...goal,
              id: newId,
              tagId,
              customName,
              activePeriod: oldPeriod,
              dailyTargetMinutes: oldPeriod === 'daily' ? targetMinutes : 0,
              dailyRestDayTargetMinutes: oldPeriod === 'daily' ? restDayTargetMinutes : 0,
              weeklyTargetMinutes: oldPeriod === 'weekly' ? targetMinutes : 0,
              monthlyTargetMinutes: oldPeriod === 'monthly' ? targetMinutes : 0,
              targetHistory: newHistory,
            };

            // Remove old fields
            delete newGoal.tagIds;
            delete newGoal.name;
            delete newGoal.period;
            delete newGoal.targetMinutes;
            delete newGoal.restDayTargetMinutes;

            newById[newId] = newGoal;
            newAllIds.push(newId);
          }
        }

        // Create deactivated goals for tags that don't have one
        const existingTagIds = new Set(newAllIds.map(id => newById[id]?.tagId).filter(Boolean));
        const allTagIds = state.focus?.tags?.allIds || [];
        for (const tagId of allTagIds) {
          const tag = state.focus?.tags?.byId?.[tagId];
          if (!tag || tag.deletedAt) continue;
          if (existingTagIds.has(tagId)) continue;

          const newGoalId = `goal-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}-${tagId.slice(-4)}`;
          newById[newGoalId] = {
            id: newGoalId,
            userId: tag.userId || 'dev-user',
            tagId,
            customName: undefined,
            activePeriod: 'daily',
            dailyTargetMinutes: 0,
            dailyRestDayTargetMinutes: 0,
            weeklyTargetMinutes: 0,
            monthlyTargetMinutes: 0,
            targetHistory: [],
            isActive: false,
            isRepeating: true,
            showTotalHours: true,
            currentProgress: 0,
            lastResetDate: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          newAllIds.push(newGoalId);
        }

        state.focus.goals.byId = newById;
        state.focus.goals.allIds = newAllIds;
      }

      // Initialize badges storage
      if (!state.focus.badges) {
        state.focus.badges = { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null };
      }

      console.log('✅ Store migration to v4 complete');
    }

    if (version < 5) {
      console.log('🔄 Migrating store to v5 (adding grove slice)...');
      const state = persistedState;
      if (!state.grove) {
        state.grove = {
          profile: null,
          privacySettings: null,
          isActive: false,
        };
      }
      console.log('✅ Store migration to v5 complete');
    }

    if (version < 6) {
      console.log('🔄 Migrating store to v6 (grove Phase 2: lastGroveVisit)...');
      const state = persistedState;
      if (!state.grove) {
        state.grove = {
          profile: null,
          privacySettings: null,
          isActive: false,
          lastGroveVisit: null,
        };
      } else {
        state.grove.lastGroveVisit = state.grove.lastGroveVisit ?? null;
      }
      console.log('✅ Store migration to v6 complete');
    }

    if (version < 7) {
      console.log('🔄 Migrating store to v7 (grove Phase 3: rankings + challenges)...');
      // No-op: rankings and challenges are server-authoritative, not persisted.
      console.log('✅ Store migration to v7 complete');
    }

    if (version < 8) {
      console.log('🔄 Migrating store to v8 (grove Phase 4: heartbeat / inner circle)...');
      const state = persistedState;
      if (!state.grove) {
        state.grove = {
          profile: null,
          privacySettings: null,
          isActive: false,
          lastGroveVisit: null,
          heartbeatSettings: null,
        };
      } else {
        state.grove.heartbeatSettings = state.grove.heartbeatSettings ?? null;
      }
      console.log('✅ Store migration to v8 complete');
    }

    if (version < 9) {
      console.log('🔄 Migrating store to v9 (referral system)...');
      const state = persistedState;
      if (!state.referral) {
        state.referral = {
          referralCode: null,
          referralCount: 0,
          claimedTier: 0,
          isLoading: false,
        };
      }
      console.log('✅ Store migration to v9 complete');
    }

    if (version === 0) {
      console.log('🔄 Migrating store from v0 → v1 (tag IDs)...');
      const state = persistedState;

      // 1. Migrate tags: byName → byId, add id field
      const nameToId: Record<string, string> = {};
      if (state?.focus?.tags?.byName) {
        const byId: Record<string, any> = {};
        const allIds: string[] = [];
        const byName = state.focus.tags.byName;
        const allNames: string[] = state.focus.tags.allNames || Object.keys(byName);

        for (const name of allNames) {
          const tag = byName[name];
          if (!tag) continue;
          const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
          nameToId[name] = id;
          byId[id] = { ...tag, id };
          allIds.push(id);
        }

        state.focus.tags = {
          ...state.focus.tags,
          byId,
          allIds,
        };
        // Remove old keys
        delete state.focus.tags.byName;
        delete state.focus.tags.allNames;
      }

      // 2. Migrate sessions: tagName → tagId
      if (state?.focus?.sessions?.byId) {
        for (const sessionId of Object.keys(state.focus.sessions.byId)) {
          const session = state.focus.sessions.byId[sessionId];
          if (session && 'tagName' in session) {
            session.tagId = nameToId[session.tagName] || session.tagName;
            delete session.tagName;
          }
        }
      }

      // 3. Migrate goals: tagNames → tagIds
      if (state?.focus?.goals?.byId) {
        for (const goalId of Object.keys(state.focus.goals.byId)) {
          const goal = state.focus.goals.byId[goalId];
          if (goal && 'tagNames' in goal) {
            goal.tagIds = (goal.tagNames || []).map((name: string) => nameToId[name] || name);
            delete goal.tagNames;
          }
          // Also migrate singular tagId (if it was a tag name, not a real ID)
          if (goal && 'tagId' in goal && typeof goal.tagId === 'string' && !goal.tagIds) {
            goal.tagIds = goal.tagId ? [nameToId[goal.tagId] || goal.tagId] : [];
            delete goal.tagId;
          }
        }
      }

      console.log('✅ Store migration v0 → v1 complete');
    }
    return persistedState;
  },

  // Selective persistence - only persist necessary data
  partialize: (state: any) => ({
    focus: {
      sessions: state.focus.sessions,
      tags: state.focus.tags,
      goals: state.focus.goals,
      todos: state.focus.todos,
      badges: state.focus.badges,
      coachReports: state.focus.coachReports,
      currentSession: state.focus.currentSession,
      selectedDate: state.focus.selectedDate,
      viewMode: state.focus.viewMode,
      currentWeekStart: state.focus.currentWeekStart,
      settings: state.focus.settings,
      lastSelectedTagId: state.focus.lastSelectedTagId,
      lastDurationByTagId: state.focus.lastDurationByTagId,
    },
    rewards: {
      balance: state.rewards.balance,
      totalEarned: state.rewards.totalEarned,
      totalSpent: state.rewards.totalSpent,
      updatedAt: state.rewards.updatedAt,
      unlockableApps: state.rewards.unlockableApps,
      accelerateCard: state.rewards.accelerateCard,
      unlockHistory: state.rewards.unlockHistory,
      // Persist one-time setup-task claim state (everSetup/claimed). Without this,
      // every cold start rehydrates tasks as undefined → normalizeSetupTasks defaults
      // to claimed:false → the goal/widget reward shows reclaimable again (re-claimable).
      tasks: state.rewards.tasks,
      purchases: state.rewards.purchases,
      customRewards: state.rewards.customRewards,
    },
    blocklist: {
      settings: state.blocklist.settings,
      currentSelectionId: state.blocklist.currentSelectionId,
      activeSessions: state.blocklist.activeSessions,
      lastUnlockDuration: state.blocklist.lastUnlockDuration,
      isAuthorized: state.blocklist.isAuthorized,
      authorizationStatus: state.blocklist.authorizationStatus,
    },
    settings: state.settings,
    auth: {
      user: state.auth?.user ?? null,
      isAuthenticated: state.auth?.isAuthenticated ?? false,
      lastSignedInUserId: state.auth?.lastSignedInUserId ?? null,
    },
    subscription: {
      tier: state.subscription?.tier ?? 'free',
      expiresAt: state.subscription?.expiresAt ?? null,
      productId: state.subscription?.productId ?? null,
    },
    sync: {
      lastSyncTime: state.sync?.lastSyncTime ?? null,
    },
    grove: {
      profile: state.grove?.profile ?? null,
      privacySettings: state.grove?.privacySettings ?? null,
      isActive: state.grove?.isActive ?? false,
      lastGroveVisit: state.grove?.lastGroveVisit ?? null,
      notificationsLastSeenAt: state.grove?.notificationsLastSeenAt ?? null,
      heartbeatSettings: state.grove?.heartbeatSettings ?? null,
      // Cached server data — shown immediately on launch, refreshed in background
      friends: state.grove?.friends ?? [],
      feed: state.grove?.feed ?? [],
      rankingsWeek: state.grove?.rankingsWeek ?? [],
      rankingsMonth: state.grove?.rankingsMonth ?? [],
      challenges: state.grove?.challenges ?? [],
    },
    referral: {
      referralCode: state.referral?.referralCode ?? null,
      referralCount: state.referral?.referralCount ?? 0,
      claimedTier: state.referral?.claimedTier ?? 0,
    },
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
          unlockHistory: {},
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

      // Restore auth slice if missing
      if (!state.auth) {
        state.auth = {
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        };
      }

      // Restore grove slice if missing
      if (!state.grove) {
        state.grove = {
          profile: null,
          privacySettings: null,
          isActive: false,
          isLoading: false,
          error: null,
          lastGroveVisit: null,
          heartbeatSettings: null,
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

/**
 * Synchronously dispatch an immediate, un-debounced write of the current store
 * state to disk.
 *
 * The normal persist path (`OptimizedStorage.setItem`) debounces writes behind a
 * `setTimeout` that runs on the JS thread. If a heavy, synchronous task freezes
 * the JS thread right after a critical mutation (e.g. completing a focus session,
 * then rendering the session-summary screen), that timer can't fire — so a
 * force-quit during the freeze loses the just-created data.
 *
 * This helper serializes the partialized state and hands it to native
 * AsyncStorage *synchronously* within the caller's stack frame, before any such
 * freeze can begin. The native write is dispatched at call time and completes on
 * the native storage thread even if JS then blocks.
 *
 * It deliberately bypasses the async empty-state guard in `OptimizedStorage`:
 * callers invoke this right after adding real data, so the state is guaranteed
 * non-empty, and routing through the guard (which awaits an AsyncStorage read)
 * would reintroduce the very async gap this avoids. The normal debounced write
 * still runs afterward and remains the source of truth for subsequent edits
 * (e.g. notes/photos added on the summary screen).
 */
export function persistStateNow(fullState: any): void {
  try {
    const payload = JSON.stringify({
      state: persistenceConfig.partialize(fullState),
      version: persistenceConfig.version,
    });
    // Fire-and-forget: the native call is enqueued synchronously here; we don't
    // await because the whole point is to not yield the JS thread.
    AsyncStorage.setItem(STORAGE_KEY, payload).catch((error) => {
      console.error('persistStateNow write failed:', error);
    });
  } catch (error) {
    console.error('persistStateNow serialization failed:', error);
  }
}

// Export utilities for testing and debugging
export const persistenceUtils = {
  validateStateIntegrity,
  STORAGE_KEY,
};
