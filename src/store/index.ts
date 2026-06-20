/**
 * Unified Zustand store - Focus-centric architecture
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { FocusSession, SessionTag, CreateSessionInput, FamilyActivitySelection, UnlockSession, UnlockTransaction, BlocklistSettings } from '../types/models';
import { FamilyControlsModule } from '../modules/BitterSweetFamilyControls';
import { LiveActivityService } from '../services/LiveActivityService';
import { WidgetService } from '../services/WidgetService';
import { FocusGoal } from './types';
import { persistenceConfig, persistStateNow } from './middleware/persistence';
import { computeBadgeStats } from '../utils/badgeStats';
import { CLASSIC_TAG_COLORS, DEFAULT_TAG_COLOR } from '../config/tagColors';
import * as Notifications from 'expo-notifications';
import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { SubscriptionSlice, createSubscriptionSlice } from './slices/subscriptionSlice';
import { SyncSlice, createSyncSlice } from './slices/syncSlice';
import { GroveSlice, createGroveSlice } from './slices/groveSlice';
import { ReferralSlice, createReferralSlice } from './slices/referralSlice';
import { SharedTagService } from '../services/sharedTag/SharedTagService';
import type { SharedTagResolveResult } from '../services/sharedTag/types';
import { AnalyticsTracker } from '../services/analytics';

interface AppStore {
  // Focus sessions and tags
  focus: {
    // Sessions (includes both planned and active sessions)
    sessions: { 
      byId: Record<string, FocusSession>; 
      allIds: string[]; 
      loading: boolean; 
      error: string | null; 
      lastUpdated: Date | null;
    };
    
    // Tags for organizing sessions (keyed by tag ID)
    tags: {
      byId: Record<string, SessionTag>;
      allIds: string[];
      loading: boolean;
      error: string | null;
      lastUpdated: Date | null;
    };
    
    // Goals for focus tracking
    goals: { 
      byId: Record<string, FocusGoal>; 
      allIds: string[]; 
      loading: boolean; 
      error: string | null; 
      lastUpdated: Date | null;
    };
    
    // Current active session
    currentSession: { 
      session: FocusSession | null; 
      isRunning: boolean; 
      remainingTime: number; 
      startedAt: Date | null;
    };
    
    // View state (for calendar/list views)
    selectedDate: Date;
    viewMode: 'day' | 'week' | 'month';
    currentWeekStart: Date;
    
    // Settings
    settings: {
      defaultDuration: number;
    };
    
    // Actions
    createSession: (sessionData: CreateSessionInput) => FocusSession;
    updateSession: (id: string, updates: Partial<FocusSession>) => void;
    adjustSessionDuration: (id: string, adjustedDuration: number) => void;
    deleteSession: (id: string) => void;
    startSession: (id: string) => void;
    completeSession: (id?: string) => void;
    createCompletedSession: (params: { id?: string; startTime: Date; endTime: Date; duration: number; targetDuration: number; tagId: string; secondaryTagId?: string; notes?: string; isManualEntry?: boolean }) => FocusSession;
    importHealthKitWorkouts: (
      workouts: { uuid: string; startDate: Date; endDate: Date; durationMinutes: number; wasUserEntered: boolean }[],
      tagId: string
    ) => { imported: number; skipped: number };

    // View actions
    setSelectedDate: (date: Date) => void;
    setViewMode: (mode: 'day' | 'week' | 'month') => void;
    goToPreviousWeek: () => void;
    goToNextWeek: () => void;
    goToCurrentWeek: () => void;
    
    // Tag management
    lastSelectedTagId: string | null;
    setLastSelectedTagId: (tagId: string | null) => void;
    lastDurationByTagId: Record<string, number>;
    setLastDurationForTag: (tagId: string, duration: number) => void;
    createTag: (tag: Omit<SessionTag, 'id' | 'usageCount' | 'sortOrder' | 'createdAt' | 'updatedAt'>) => SessionTag;
    updateTag: (id: string, updates: Partial<SessionTag>) => void;
    deleteTag: (id: string) => void;
    reorderTags: (orderedIds: string[]) => void;

    // Goal management
    addGoal: (goal: Omit<FocusGoal, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateGoal: (id: string, updates: Partial<FocusGoal>) => void;
    deleteGoal: (id: string) => void;
    concludeGoal: (id: string) => void;
    deleteBadge: (id: string) => void;
    reorderGoals: (orderedIds: string[]) => void;
    getActiveGoals: () => FocusGoal[];

    // Badges
    badges: {
      byId: Record<string, any>;
      allIds: string[];
      loading: boolean;
      error: string | null;
      lastUpdated: Date | null;
    };

    // Shared tag actions
    shareTag: (tagId: string) => Promise<string>; // returns share code
    stopSharingTag: (tagId: string) => Promise<void>;
    resolveSharedTagCode: (code: string) => Promise<SharedTagResolveResult>;
    // Join a resolved shared tag. Pass an existing local tag id to map onto it,
    // or omit to clone a fresh tag. Returns the joiner's local tag either way.
    joinSharedTag: (result: SharedTagResolveResult, existingTagId?: string) => Promise<SessionTag>;
    leaveSharedTag: (tagId: string) => Promise<void>;
    removeJoiner: (membershipId: string) => Promise<void>;
    fetchJoinerStats: (ownerTagId: string, startDate: string, endDate: string) => Promise<any[]>;

    // Shared tag stats (ephemeral)
    sharedTagStats: {
      joinerStats: any[];
      loading: boolean;
      currentTagId: string | null;
    };
  };

  // UI
  ui: {
    isHydrated: boolean;
    modals: Record<string, any>;
    loading: { global: boolean; actions: Record<string, boolean> };
    errors: any[];
    showModal: (type: string, data?: any) => void;
    hideModal: (type: string) => void;
    setLoading: (action: string, loading: boolean) => void;
    addError: (error: any) => void;
    clearError: (errorId: string) => void;
    clearAllErrors: () => void;
    isModalVisible: (type: string) => boolean;
    getModalData: (type: string) => any;
    isLoading: (action?: string) => boolean;
    getErrors: () => any[];
  };
  
  // Settings
  settings: {
    theme: 'dark' | 'light';
    language: string;
    notifications: { enabled: boolean; sound: boolean; vibration: boolean };
    updateTheme: (theme: 'dark' | 'light') => void;
    updateLanguage: (language: string) => void;
    updateNotifications: (settings: { enabled: boolean; sound: boolean; vibration: boolean }) => void;
  };
  
  // Rewards
  rewards: {
    balance: number;
    totalEarned: number;
    totalSpent: number;
    unlockableApps: any[];
    accelerateCard: { activatedAt: string; expiresAt: string } | null;
    earnFruits: (amount: number, source: string, metadata?: any) => void;
    spendFruits: (amount: number, purpose: string, metadata?: any) => void;
    unlockApp: (appId: string) => Promise<boolean>;
    activateAccelerateCard: () => void;
    isAccelerateActive: () => boolean;
  };

  // Auth
  auth: AuthSlice;

  // Subscription
  subscription: SubscriptionSlice;

  // Sync
  sync: SyncSlice;

  // Grove (social profile)
  grove: GroveSlice;

  // Referral
  referral: ReferralSlice;

  // Blocklist
  blocklist: {
    // Settings and blocked apps
    settings: BlocklistSettings;

    // Current active selection ID
    currentSelectionId: string | null;

    // Current unlock sessions
    activeSessions: {
      byId: Record<string, UnlockSession>;
      allIds: string[];
    };

    // Unlock history
    transactions: {
      byId: Record<string, UnlockTransaction>;
      allIds: string[];
    };

    // Edit cost tracking (weekly escalation: 1, 2, 4, 8, 16...)
    editHistory: {
      weekStart: string; // ISO date string of current week's Monday
      editsThisWeek: number;
    };

    // Last unlock duration (for pre-filling slider)
    lastUnlockDuration: number | null;

    // Runtime state
    isAuthorized: boolean;
    authorizationStatus: 0 | 1 | 2 | 3; // 0=notDetermined, 1=denied, 2=approved, 3=unknown
    lastAuthCheck: Date | null;

    // Actions
    checkAuthorizationStatus: () => Promise<boolean>;
    requestAuthorization: () => Promise<boolean>;
    updateBlockedApps: (selection: FamilyActivitySelection, metadata?: { applicationCount?: number; categoryCount?: number; webDomainCount?: number }, chargeFruit?: boolean) => Promise<void>;
    updateSettings: (settings: Partial<BlocklistSettings>) => void;
    requestUnlock: (appTokens: any[], duration: number) => Promise<UnlockSession | null>;
    endUnlock: (sessionId: string, reason?: 'expired' | 'manual') => void;
    checkActiveUnlocks: () => void;
    getBlocklistEditCost: () => number;
  };
}

const getWeekStart = () => {
  const today = new Date();
  const currentDay = today.getDay();
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - daysFromMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomStr}`;
};

export const calculateFruitsEarnedForDuration = (duration: number, targetDuration: number = duration, multiplier: number = 1) => {
  const earnedMinutes = Math.max(0, Math.floor(duration));
  // Only count minutes up to the target duration for fruit earning
  const countedMinutes = Math.min(earnedMinutes, Math.max(0, Math.floor(targetDuration)));
  const baseFruits = Math.floor(countedMinutes / 5);
  // +1 bonus fruit for completing the full set duration
  const completionBonus = earnedMinutes >= Math.floor(targetDuration) && targetDuration > 0 ? 1 : 0;
  return (baseFruits + completionBonus) * multiplier;
};

export const useAppStore = create<AppStore>()(
  persist(
    devtools(
      (set, get) => ({
      // Focus state (merged with tasks)
      focus: {
        sessions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
        tags: {
          byId: {},
          allIds: [],
          loading: false,
          error: null,
          lastUpdated: null
        },
        goals: {
          byId: {},
          allIds: [],
          loading: false,
          error: null,
          lastUpdated: null
        },
        badges: {
          byId: {},
          allIds: [],
          loading: false,
          error: null,
          lastUpdated: null
        },
        currentSession: { session: null, isRunning: false, remainingTime: 0, startedAt: null },
        selectedDate: new Date(),
        viewMode: 'day',
        currentWeekStart: getWeekStart(),
        settings: {
          defaultDuration: 25,
        },
        
        // Session actions
        createSession: (sessionData) => {
          console.log('📝 Creating focus session:', sessionData);
          const sessionId = generateId();
          
          // Calculate duration from startTime and endTime
          const duration = Math.round(
            (sessionData.endTime.getTime() - sessionData.startTime.getTime()) / (1000 * 60)
          );
          
          const accelerateMultiplier = get().rewards.isAccelerateActive() ? 2 : 1;

          const session: FocusSession = {
            id: sessionId,
            startTime: sessionData.startTime,
            endTime: sessionData.endTime,
            duration: duration,
            initialSetDuration: duration,
            actualDuration: duration,
            adjustedDuration: duration,
            tagId: sessionData.tagId,
            notes: sessionData.notes,
            accelerateMultiplier,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          set((state) => ({
            focus: {
              ...state.focus,
              sessions: {
                ...state.focus.sessions,
                byId: { ...state.focus.sessions.byId, [sessionId]: session },
                allIds: [...state.focus.sessions.allIds, sessionId],
              }
            }
          }));

          // Calculate and award fruits (+1 bonus for completing set duration)
          const fruitsEarned = calculateFruitsEarnedForDuration(duration, duration, accelerateMultiplier);
          if (fruitsEarned > 0) {
            get().rewards.earnFruits(fruitsEarned, 'focus_session', {
              sessionId: sessionId,
              duration: duration,
            });
            console.log('🍎 Fruits earned:', fruitsEarned, 'for session:', sessionId);
          }
          
          console.log('✅ Focus session created:', session);
          return session;
        },
        
        updateSession: (sessionId, updates) => {
          console.log('📝 Updating session:', sessionId, updates);
          set((state) => {
            const existingSession = state.focus.sessions.byId[sessionId];
            if (existingSession) {
              return {
                focus: {
                  ...state.focus,
                  sessions: {
                    ...state.focus.sessions,
                    byId: {
                      ...state.focus.sessions.byId,
                      [sessionId]: {
                        ...existingSession,
                        ...updates,
                        updatedAt: new Date(),
                      }
                    }
                  }
                }
              };
            }
            return state;
          });
        },

        adjustSessionDuration: (sessionId, adjustedDuration) => {
          const session = get().focus.sessions.byId[sessionId];
          if (!session) return;

          const actualDuration = session.actualDuration ?? session.duration;
          const previousAdjustedDuration = session.adjustedDuration ?? session.duration;
          const nextAdjustedDuration = Math.max(0, Math.min(actualDuration, Math.round(adjustedDuration)));
          const targetDuration = session.initialSetDuration ?? session.duration;
          const adjustMultiplier = get().rewards.isAccelerateActive() ? 2 : 1;
          const previousFruits = session.isManualEntry ? 0 : calculateFruitsEarnedForDuration(previousAdjustedDuration, targetDuration, adjustMultiplier);
          const nextFruits = session.isManualEntry ? 0 : calculateFruitsEarnedForDuration(nextAdjustedDuration, targetDuration, adjustMultiplier);
          const fruitDelta = nextFruits - previousFruits;

          set((state) => ({
            focus: {
              ...state.focus,
              sessions: {
                ...state.focus.sessions,
                byId: {
                  ...state.focus.sessions.byId,
                  [sessionId]: {
                    ...session,
                    initialSetDuration: session.initialSetDuration ?? session.duration,
                    actualDuration,
                    adjustedDuration: nextAdjustedDuration,
                    duration: nextAdjustedDuration,
                    updatedAt: new Date(),
                  }
                }
              }
            },
            rewards: fruitDelta === 0 ? state.rewards : {
              ...state.rewards,
              // Balance can never drop below 0 (fruitDelta may be negative).
              balance: Math.max(0, state.rewards.balance + fruitDelta),
              totalEarned: Math.max(0, state.rewards.totalEarned + fruitDelta),
              updatedAt: new Date().toISOString(),
            }
          }));

          if (fruitDelta !== 0) {
            const newBalance = get().rewards.balance;
            FamilyControlsModule.updateShieldBalance(newBalance).catch((error) => {
              console.error('Failed to update shield balance after session adjustment:', error);
            });
          }

          // Duration change alters this session's challenge contribution — recompute.
          get().grove.recomputeChallengeHitsForTag(session.tagId).catch(() => {});
          if (session.secondaryTagId && session.secondaryTagId !== session.tagId) {
            get().grove.recomputeChallengeHitsForTag(session.secondaryTagId).catch(() => {});
          }
        },
        
        deleteSession: (sessionId) => {
          console.log('🗑️ Deleting session:', sessionId);
          
          // Get the session being deleted to check if it had rewards
          const sessionToDelete = get().focus.sessions.byId[sessionId];
          
          set((state) => {
            // Remove the session
            const { [sessionId]: removed, ...remainingSessions } = state.focus.sessions.byId;

            // Calculate fruits to deduct based on session duration and multiplier.
            // Manual entries never earned fruits on creation (isManualEntry → 0),
            // so they must deduct 0 here — otherwise deleting one removes fruits
            // that were never granted.
            const fruitsToDeduct = sessionToDelete && !sessionToDelete.isManualEntry
              ? calculateFruitsEarnedForDuration(
                  sessionToDelete.adjustedDuration ?? sessionToDelete.duration ?? 0,
                  sessionToDelete.initialSetDuration ?? sessionToDelete.duration ?? 0,
                  sessionToDelete.accelerateMultiplier ?? 1
                )
              : 0;

            return {
              focus: {
                ...state.focus,
                sessions: {
                  ...state.focus.sessions,
                  byId: remainingSessions,
                  allIds: state.focus.sessions.allIds.filter(id => id !== sessionId),
                }
              },
              rewards: {
                ...state.rewards,
                // Never let the balance (or lifetime total) go negative.
                balance: Math.max(0, state.rewards.balance - fruitsToDeduct),
                totalEarned: Math.max(0, state.rewards.totalEarned - fruitsToDeduct),
                updatedAt: new Date().toISOString(),
              }
            };
          });

          if (sessionToDelete) {
            console.log('🗑️ Session deleted and corresponding rewards removed:', sessionId);

            // Update shield configuration with new balance after deletion
            const newBalance = get().rewards.balance;
            const focusActive = get().focus.currentSession.isRunning;
            FamilyControlsModule.updateShieldBalance(newBalance, focusActive).catch((error) => {
              console.error('Failed to update shield balance after deleting session:', error);
            });

            // Removing the session changes challenge hits for its tag — recompute.
            get().grove.recomputeChallengeHitsForTag(sessionToDelete.tagId).catch(() => {});
            if (sessionToDelete.secondaryTagId && sessionToDelete.secondaryTagId !== sessionToDelete.tagId) {
              get().grove.recomputeChallengeHitsForTag(sessionToDelete.secondaryTagId).catch(() => {});
            }
          }
        },
        
        startSession: (sessionId) => {
          console.log('▶️ Starting session:', sessionId);
          const session = get().focus.sessions.byId[sessionId];
          if (session) {
            set((state) => ({
              focus: {
                ...state.focus,
                currentSession: {
                  session: session,
                  isRunning: true,
                  remainingTime: session.duration * 60, // Convert to seconds
                  startedAt: new Date(),
                }
              }
            }));
          }
        },
        
        completeSession: (sessionId) => {
          const id = sessionId || get().focus.currentSession.session?.id;
          if (id) {
            console.log('✅ Completing session:', id);
            const session = get().focus.sessions.byId[id];
            if (session) {
              const actualDuration = session.duration; // Use the actual duration
              
              // Session is already completed, no need to update status
              // Duration is already set when creating the session
              
              // Calculate and award fruits (+1 bonus for completing set duration)
              const completeMultiplier = get().rewards.isAccelerateActive() ? 2 : 1;
              const fruitsEarned = calculateFruitsEarnedForDuration(actualDuration, session.initialSetDuration ?? actualDuration, completeMultiplier);

              // Store the accelerate multiplier on the session
              get().focus.updateSession(id, { accelerateMultiplier: completeMultiplier });

              if (fruitsEarned > 0) {
                get().rewards.earnFruits(fruitsEarned, 'focus_session', {
                  sessionId: id,
                  duration: actualDuration,
                });
                console.log('🍎 Fruits earned:', fruitsEarned, 'for session:', id);
              }

              // Clear current session if it's the one being completed
              if (get().focus.currentSession.session?.id === id) {
                set((state) => ({
                  focus: {
                    ...state.focus,
                    currentSession: {
                      session: null,
                      isRunning: false,
                      remainingTime: 0,
                      startedAt: null,
                    }
                  }
                }));
              }
            }
          }
        },
        
        createCompletedSession: (params: { id?: string; startTime: Date; endTime: Date; duration: number; targetDuration: number; tagId: string; secondaryTagId?: string; notes?: string; isManualEntry?: boolean }) => {
          console.log('📝 Creating completed session:', params);
          // Reuse a caller-supplied id when present (e.g. native widget/Live
          // Activity stop already pushed this session to Supabase under that id)
          // so the local row + its sync upsert merge with the native write
          // instead of creating a duplicate. Falls back to a fresh id otherwise.
          const sessionId = params.id || generateId();

          const createCompletedMultiplier = get().rewards.isAccelerateActive() ? 2 : 1;

          const completedSession: FocusSession = {
            id: sessionId,
            startTime: params.startTime,
            endTime: params.endTime,
            duration: params.duration,
            initialSetDuration: params.targetDuration,
            actualDuration: params.duration,
            adjustedDuration: params.duration,
            tagId: params.tagId,
            secondaryTagId: params.secondaryTagId,
            notes: params.notes,
            accelerateMultiplier: createCompletedMultiplier,
            createdAt: new Date(),
            updatedAt: new Date(),
            isManualEntry: params.isManualEntry,
          };

          set((state) => ({
            focus: {
              ...state.focus,
              sessions: {
                ...state.focus.sessions,
                byId: { ...state.focus.sessions.byId, [sessionId]: completedSession },
                allIds: [...state.focus.sessions.allIds, sessionId],
              }
            }
          }));

          // Calculate and award fruits (+1 bonus for completing set duration)
          const fruitsEarned = params.isManualEntry ? 0 : calculateFruitsEarnedForDuration(params.duration, params.targetDuration, createCompletedMultiplier);
          if (fruitsEarned > 0) {
            get().rewards.earnFruits(fruitsEarned, 'focus_session', {
              sessionId: sessionId,
              duration: params.duration,
            });
            console.log('🍎 Fruits earned:', fruitsEarned, 'for completed session:', sessionId);
          }

          // Any new session can land in a challenge's tag/date range — recompute
          // its hits. Fire-and-forget so creation stays synchronous; the method
          // swallows its own errors. Covers every creation flow (manual entry,
          // widget/Live Activity stop, in-app finish) from one place.
          get().grove.recomputeChallengeHitsForTag(params.tagId).catch(() => {});
          if (params.secondaryTagId && params.secondaryTagId !== params.tagId) {
            get().grove.recomputeChallengeHitsForTag(params.secondaryTagId).catch(() => {});
          }

          // Persist immediately, bypassing the debounced write. The summary screen
          // that renders right after this can do heavy synchronous work and freeze
          // the JS thread; the normal 100ms debounce timer would be stuck behind
          // that freeze, so a force-quit would lose this session. Dispatching the
          // native write synchronously here guarantees the session reaches disk
          // first. Notes/photos added later on the summary screen still flow through
          // the normal debounced persist + cloud sync paths.
          persistStateNow(get());

          console.log('✅ Completed focus session created:', completedSession);
          return completedSession;
        },

        importHealthKitWorkouts: (workouts, tagId) => {
          const state0 = get();

          // Validate the linked tag still exists before importing anything
          // (e.g. it may have been deleted, or belong to a previous account).
          if (!state0.focus.tags.byId[tagId]) {
            console.warn(`[HealthKit] import skipped: tag ${tagId} not found`);
            return { imported: 0, skipped: workouts.length };
          }

          const existingById = state0.focus.sessions.byId;
          const now = new Date();
          const toAdd: FocusSession[] = [];
          let skipped = 0;
          let fruitsEarned = 0;

          for (const w of workouts) {
            // Deterministic id from the HealthKit UUID makes import idempotent and
            // survives cloud pulls / AsyncStorage wipes — re-importing the same
            // workout computes the same id and is skipped below.
            const id = `hk-${w.uuid}`;

            if (existingById[id]) { skipped++; continue; }
            // Always skip hand-logged Health entries: only genuine device-recorded
            // workouts are imported, which keeps reward-bearing imports un-farmable.
            if (w.wasUserEntered) { skipped++; continue; }
            if (!(w.durationMinutes > 0)) { skipped++; continue; }

            // Reward-bearing like a real completed session. No accelerate multiplier:
            // these are backfilled past workouts, so current accelerate must not apply.
            fruitsEarned += calculateFruitsEarnedForDuration(w.durationMinutes, w.durationMinutes, 1);

            toAdd.push({
              id,
              startTime: w.startDate,
              endTime: w.endDate,
              duration: w.durationMinutes,
              initialSetDuration: w.durationMinutes,
              actualDuration: w.durationMinutes,
              adjustedDuration: w.durationMinutes,
              tagId,
              accelerateMultiplier: 1,
              createdAt: now,
              updatedAt: now,
              isManualEntry: false,
            });
          }

          if (toAdd.length > 0) {
            set((state) => {
              const byId = { ...state.focus.sessions.byId };
              const allIds = [...state.focus.sessions.allIds];
              for (const s of toAdd) {
                byId[s.id] = s;
                allIds.push(s.id);
              }
              return {
                focus: {
                  ...state.focus,
                  sessions: { ...state.focus.sessions, byId, allIds },
                },
              };
            });

            // Award fruits for the imported workouts. Deletion deducts the same
            // amount (isManualEntry === false), so the grant stays symmetric.
            if (fruitsEarned > 0) {
              get().rewards.earnFruits(fruitsEarned, 'healthkit_import', { count: toAdd.length });
              console.log('🍎 Fruits earned:', fruitsEarned, 'for', toAdd.length, 'imported workouts');
            }

            // Imported sessions can land in a challenge's tag/date range — keep
            // challenge hit counts correct, same as createCompletedSession.
            get().grove.recomputeChallengeHitsForTag(tagId).catch(() => {});
          }

          console.log(`[HealthKit] import: imported=${toAdd.length} skipped=${skipped} tagId=${tagId}`);
          return { imported: toAdd.length, skipped };
        },

        // View actions
        setSelectedDate: (date) => {
          console.log('📅 Setting selected date:', date);
          set((state) => ({
            focus: { ...state.focus, selectedDate: date }
          }));
        },
        
        setViewMode: (mode) => {
          console.log('👁️ Setting view mode:', mode);
          set((state) => ({
            focus: { ...state.focus, viewMode: mode }
          }));
        },
        
        goToPreviousWeek: () => {
          console.log('⬅️ Going to previous week');
          set((state) => {
            const newWeekStart = new Date(state.focus.currentWeekStart);
            newWeekStart.setDate(newWeekStart.getDate() - 7);
            return {
              focus: { ...state.focus, currentWeekStart: newWeekStart }
            };
          });
        },
        
        goToNextWeek: () => {
          console.log('➡️ Going to next week');
          set((state) => {
            const newWeekStart = new Date(state.focus.currentWeekStart);
            newWeekStart.setDate(newWeekStart.getDate() + 7);
            return {
              focus: { ...state.focus, currentWeekStart: newWeekStart }
            };
          });
        },
        
        goToCurrentWeek: () => {
          console.log('📍 Going to current week');
          set((state) => ({
            focus: { ...state.focus, currentWeekStart: getWeekStart() }
          }));
        },
        
        // Goal management
        addGoal: (goalData) => {
          console.log('🎯 Creating goal:', goalData);
          const goalId = generateId();
          const goal: FocusGoal = {
            ...goalData,
            id: goalId,
            sortOrder: get().focus.goals.allIds.length,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set((state) => ({
            focus: {
              ...state.focus,
              goals: {
                ...state.focus.goals,
                byId: { ...state.focus.goals.byId, [goalId]: goal },
                allIds: [...state.focus.goals.allIds, goalId],
              }
            }
          }));
        },

        updateGoal: (goalId, updates) => {
          console.log('🎯 Updating goal:', goalId, updates);
          // Goals are auto-created (one per tag), so creation isn't user intent —
          // the real "user set a goal" signal is *activating* one (isActive false→true).
          const wasActive = get().focus.goals.byId[goalId]?.isActive === true;
          set((state) => {
            const existingGoal = state.focus.goals.byId[goalId];
            if (existingGoal) {
              return {
                focus: {
                  ...state.focus,
                  goals: {
                    ...state.focus.goals,
                    byId: {
                      ...state.focus.goals.byId,
                      [goalId]: { ...existingGoal, ...updates, updatedAt: new Date() }
                    }
                  }
                }
              };
            }
            return state;
          });

          // Analytics: goal adoption + the has_set_goal retention cohort.
          if (updates.isActive === true && !wasActive) {
            const goal = get().focus.goals.byId[goalId];
            AnalyticsTracker.track(
              'goal_activated',
              { active_period: goal?.activePeriod, tag_id: goal?.tagId },
              { setOnce: { has_set_goal: true } }
            );
          }
        },
        
        deleteGoal: (goalId) => {
          console.log('🚫 Deactivating goal:', goalId);
          set((state) => {
            const goal = state.focus.goals.byId[goalId];
            if (!goal) return state;
            return {
              focus: {
                ...state.focus,
                goals: {
                  ...state.focus.goals,
                  byId: {
                    ...state.focus.goals.byId,
                    [goalId]: { ...goal, isActive: false, updatedAt: new Date() },
                  },
                }
              }
            };
          });
        },

        concludeGoal: (goalId) => {
          const state = get();
          const goal = state.focus.goals.byId[goalId];
          if (!goal) return;

          const tag = state.focus.tags.byId[goal.tagId];
          const sessions = state.focus.sessions.allIds
            .map((sid: string) => state.focus.sessions.byId[sid])
            .filter(Boolean);

          const weekStartDay = 1; // Always Monday
          const restDays = (goal as any).restDays || [0, 6];

          const badgeData = computeBadgeStats(
            goal,
            sessions,
            { icon: tag?.icon || '', name: tag?.name || '', color: tag?.color },
            weekStartDay,
            restDays,
          );

          set((state) => {
            const existingGoal = state.focus.goals.byId[goalId];
            if (!existingGoal) return state;
            const badges = state.focus.badges || { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null };

            const existingBadge = Object.values(badges.byId).find((b: any) => b.goalId === goalId) as any;
            const badgeId = existingBadge ? existingBadge.id : `badge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const badge = {
              ...badgeData,
              id: badgeId,
              goalId,
              createdAt: existingBadge ? existingBadge.createdAt : new Date(),
              updatedAt: new Date(),
            };

            return {
              focus: {
                ...state.focus,
                goals: {
                  ...state.focus.goals,
                  byId: {
                    ...state.focus.goals.byId,
                    [goalId]: { ...existingGoal, isActive: false, updatedAt: new Date() },
                  },
                },
                badges: {
                  ...badges,
                  byId: { ...badges.byId, [badge.id]: badge },
                  allIds: existingBadge ? badges.allIds : [...badges.allIds, badge.id],
                  lastUpdated: new Date(),
                },
              }
            };
          });

          if (__DEV__) {
            console.log('✅ Goal concluded, badge created or updated for goal:', goalId);
          }
        },

        deleteBadge: (badgeId) => {
          set((state) => {
            const badges = state.focus.badges || { byId: {}, allIds: [] };
            const { [badgeId]: removed, ...remainingBadges } = badges.byId;
            return {
              focus: {
                ...state.focus,
                badges: {
                  ...badges,
                  byId: remainingBadges,
                  allIds: badges.allIds.filter((id: string) => id !== badgeId),
                  lastUpdated: new Date(),
                }
              }
            };
          });
        },

        reorderGoals: (orderedIds) => {
          const now = new Date();
          set((state) => {
            const updatedById = { ...state.focus.goals.byId };
            orderedIds.forEach((id, index) => {
              if (updatedById[id]) {
                updatedById[id] = {
                  ...updatedById[id],
                  sortOrder: index,
                  updatedAt: now,
                };
              }
            });
            return {
              focus: {
                ...state.focus,
                goals: {
                  ...state.focus.goals,
                  byId: updatedById,
                  allIds: orderedIds,
                },
              },
            };
          });
        },

        getActiveGoals: () => {
          return Object.values(get().focus.goals.byId).filter((goal: FocusGoal) => goal.isActive);
        },
        
        // Tag management
        lastSelectedTagId: null as string | null,
        setLastSelectedTagId: (tagId: string | null) => {
          set((state) => ({
            focus: { ...state.focus, lastSelectedTagId: tagId }
          }));
        },
        lastDurationByTagId: {} as Record<string, number>,
        setLastDurationForTag: (tagId: string, duration: number) => {
          set((state) => ({
            focus: {
              ...state.focus,
              lastDurationByTagId: { ...state.focus.lastDurationByTagId, [tagId]: duration }
            }
          }));
        },
        createTag: (tagData) => {
          console.log('🏷️ Creating tag:', tagData);
          const tagId = generateId();
          const now = new Date();
          const tag: SessionTag = {
            ...tagData,
            id: tagId,
            usageCount: 0,
            sortOrder: get().focus.tags.allIds.length,
            createdAt: now,
            updatedAt: now,
          };

          const goalId = generateId();
          const newGoal: FocusGoal = {
            id: goalId,
            userId: 'local-user',
            tagId: tagId,
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
            sortOrder: get().focus.goals.allIds.length,
            lastResetDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          set((state) => ({
            focus: {
              ...state.focus,
              tags: {
                ...state.focus.tags,
                byId: { ...state.focus.tags.byId, [tagId]: tag },
                allIds: [...state.focus.tags.allIds, tagId],
              },
              goals: {
                ...state.focus.goals,
                byId: { ...state.focus.goals.byId, [goalId]: newGoal },
                allIds: [...state.focus.goals.allIds, goalId],
              }
            }
          }));
          return tag;
        },

        updateTag: (tagId, updates) => {
          console.log('🏷️ Updating tag:', tagId, updates);
          set((state) => {
            const existingTag = state.focus.tags.byId[tagId];
            if (existingTag) {
              const updatedTag = { ...existingTag, ...updates, id: tagId }; // id is immutable
              return {
                focus: {
                  ...state.focus,
                  tags: {
                    ...state.focus.tags,
                    byId: {
                      ...state.focus.tags.byId,
                      [tagId]: updatedTag
                    }
                  }
                }
              };
            }
            return state;
          });
        },

        deleteTag: (tagId) => {
          console.log('🗑️ Soft-deleting tag:', tagId);
          const tag = get().focus.tags.byId[tagId];

          // Weak link: if this tag is one the user joined from someone else,
          // end the membership so the owner stops seeing them in shared stats.
          // Fire-and-forget — deletion is never blocked on the server call.
          if (tag?.sharedFromTagId) {
            SharedTagService.leaveMembership(tagId).catch((e) =>
              console.warn('Failed to end shared-tag membership on delete:', e?.message)
            );
          }

          if (tag) {
            set((state) => {
              // Remove last duration entry for this tag
              const { [tagId]: _removedDuration, ...remainingDurations } = state.focus.lastDurationByTagId;

              // Deactivate the associated goal (1:1 tag-goal relationship)
              const updatedGoals = { ...state.focus.goals.byId };
              for (const goalId of state.focus.goals.allIds) {
                const goal = updatedGoals[goalId];
                if (goal && goal.tagId === tagId) {
                  updatedGoals[goalId] = {
                    ...goal,
                    isActive: false,
                    updatedAt: new Date(),
                  };
                }
              }

              return {
                focus: {
                  ...state.focus,
                  lastDurationByTagId: remainingDurations,
                  tags: {
                    ...state.focus.tags,
                    byId: {
                      ...state.focus.tags.byId,
                      [tagId]: {
                        ...state.focus.tags.byId[tagId],
                        deletedAt: new Date(),
                        updatedAt: new Date(),
                      },
                    },
                  },
                  goals: {
                    ...state.focus.goals,
                    byId: updatedGoals,
                  },
                }
              };
            });

            console.log(`✅ Tag ${tag.name} soft-deleted`);
          }
        },

        reorderTags: (orderedIds) => {
          const now = new Date();
          set((state) => {
            const updatedById = { ...state.focus.tags.byId };
            orderedIds.forEach((id, index) => {
              if (updatedById[id]) {
                updatedById[id] = {
                  ...updatedById[id],
                  sortOrder: index,
                  updatedAt: now,
                };
              }
            });
            return {
              focus: {
                ...state.focus,
                tags: {
                  ...state.focus.tags,
                  byId: updatedById,
                  allIds: orderedIds,
                },
              },
            };
          });
        },

        // --- Shared Tag Actions ---

        sharedTagStats: {
          joinerStats: [],
          loading: false,
          currentTagId: null,
        },

        shareTag: async (tagId: string) => {
          const link = await SharedTagService.generateShareCode(tagId);

          // Mark local tag as sharing
          set((state) => {
            const existingTag = state.focus.tags.byId[tagId];
            if (!existingTag) return state;
            return {
              focus: {
                ...state.focus,
                tags: {
                  ...state.focus.tags,
                  byId: {
                    ...state.focus.tags.byId,
                    [tagId]: { ...existingTag, isSharing: true, updatedAt: new Date() },
                  },
                },
              },
            };
          });

          return link.code;
        },

        stopSharingTag: async (tagId: string) => {
          await SharedTagService.deactivateShareCode(tagId);

          set((state) => {
            const existingTag = state.focus.tags.byId[tagId];
            if (!existingTag) return state;
            return {
              focus: {
                ...state.focus,
                tags: {
                  ...state.focus.tags,
                  byId: {
                    ...state.focus.tags.byId,
                    [tagId]: { ...existingTag, isSharing: false, updatedAt: new Date() },
                  },
                },
              },
            };
          });
        },

        resolveSharedTagCode: async (code: string) => {
          return SharedTagService.resolveShareCode(code);
        },

        joinSharedTag: async (result: SharedTagResolveResult, existingTagId?: string) => {
          const now = new Date();
          // Fields stamped on the joiner's local tag so the UI shows the
          // "from {owner}" / Shared badge. These are purely cosmetic — the
          // owner→joiner link that drives stats lives in shared_tag_memberships.
          const sharedFields = {
            sharedFromTagId: result.owner_tag_id,
            sharedFromUserId: result.owner_user_id,
            sharedOwnerName: result.owner_display_name,
          };

          // --- Path A: map onto an existing local tag (challenge parity) ---
          if (existingTagId) {
            const existingTag = get().focus.tags.byId[existingTagId];
            if (!existingTag) throw new Error('Tag no longer exists');

            // Membership first so a server failure leaves local state untouched.
            await SharedTagService.createMembership(
              result.owner_tag_id,
              result.owner_user_id,
              existingTagId
            );

            const stampedTag: SessionTag = { ...existingTag, ...sharedFields, updatedAt: now };
            set((state) => ({
              focus: {
                ...state.focus,
                tags: {
                  ...state.focus.tags,
                  byId: { ...state.focus.tags.byId, [existingTagId]: stampedTag },
                },
              },
            }));

            return stampedTag;
          }

          // --- Path B: clone a fresh local tag (copy of owner's tag) ---
          const tagId = generateId();
          const goalId = generateId();

          const newTag: SessionTag = {
            id: tagId,
            name: result.tag_name,
            icon: result.tag_icon,
            color: result.tag_color,
            usageCount: 0,
            sortOrder: get().focus.tags.allIds.length,
            createdAt: now,
            updatedAt: now,
            ...sharedFields,
          };

          const newGoal: FocusGoal = {
            id: goalId,
            userId: 'local-user',
            tagId: tagId,
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
            sortOrder: get().focus.goals.allIds.length,
            lastResetDate: now,
            createdAt: now,
            updatedAt: now,
          };

          // Create membership on server
          await SharedTagService.createMembership(
            result.owner_tag_id,
            result.owner_user_id,
            tagId
          );

          set((state) => ({
            focus: {
              ...state.focus,
              tags: {
                ...state.focus.tags,
                byId: { ...state.focus.tags.byId, [tagId]: newTag },
                allIds: [...state.focus.tags.allIds, tagId],
              },
              goals: {
                ...state.focus.goals,
                byId: { ...state.focus.goals.byId, [goalId]: newGoal },
                allIds: [...state.focus.goals.allIds, goalId],
              },
            },
          }));

          return newTag;
        },

        leaveSharedTag: async (tagId: string) => {
          await SharedTagService.leaveMembership(tagId);

          // Unlink only — keep the tag, its sessions, and its goal. Clearing the
          // shared-from fields turns it back into a plain tag (the swipe action
          // reverts from Unlink to Delete). SyncMapper writes these as null, so
          // the unlink propagates to the cloud copy too.
          set((state) => {
            const existingTag = state.focus.tags.byId[tagId];
            if (!existingTag) return state;

            const { sharedFromTagId, sharedFromUserId, sharedOwnerName, ...rest } = existingTag;
            return {
              focus: {
                ...state.focus,
                tags: {
                  ...state.focus.tags,
                  byId: {
                    ...state.focus.tags.byId,
                    [tagId]: { ...rest, updatedAt: new Date() },
                  },
                },
              },
            };
          });
        },

        removeJoiner: async (membershipId: string) => {
          await SharedTagService.removeJoiner(membershipId);

          // Refresh stats if currently viewing
          const currentTagId = get().focus.sharedTagStats.currentTagId;
          if (currentTagId) {
            // Remove joiner from local stats
            set((state) => ({
              focus: {
                ...state.focus,
                sharedTagStats: {
                  ...state.focus.sharedTagStats,
                  joinerStats: state.focus.sharedTagStats.joinerStats.filter(
                    (j: any) => j.membership_id !== membershipId
                  ),
                },
              },
            }));
          }
        },

        fetchJoinerStats: async (ownerTagId: string, startDate: string, endDate: string) => {
          set((state) => ({
            focus: {
              ...state.focus,
              sharedTagStats: {
                ...state.focus.sharedTagStats,
                loading: true,
                currentTagId: ownerTagId,
              },
            },
          }));

          try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const stats = await SharedTagService.fetchJoinerStats(ownerTagId, startDate, endDate, tz);

            set((state) => ({
              focus: {
                ...state.focus,
                sharedTagStats: {
                  joinerStats: stats,
                  loading: false,
                  currentTagId: ownerTagId,
                },
              },
            }));

            return stats;
          } catch (error) {
            set((state) => ({
              focus: {
                ...state.focus,
                sharedTagStats: {
                  ...state.focus.sharedTagStats,
                  loading: false,
                },
              },
            }));
            throw error;
          }
        },
      },

      // Auth state
      auth: createAuthSlice(set, get),

      // Subscription state
      subscription: createSubscriptionSlice(set, get),

      // Sync state
      sync: createSyncSlice(set, get),

      // Grove (social profile) state
      grove: createGroveSlice(set, get),

      // Referral state
      referral: createReferralSlice(set, get),

      // UI state
      ui: {
        isHydrated: false,
        modals: {},
        loading: { global: false, actions: {} },
        errors: [],
        showModal: (type: string, data?: any) => {
          set((state) => ({
            ui: {
              ...state.ui,
              modals: { ...state.ui.modals, [type]: data || {} }
            }
          }));
        },
        hideModal: (type: string) => {
          set((state) => {
            const { [type]: removed, ...remainingModals } = state.ui.modals;
            return {
              ui: { ...state.ui, modals: remainingModals }
            };
          });
        },
        setLoading: (action: string, loading: boolean) => {
          set((state) => ({
            ui: {
              ...state.ui,
              loading: {
                ...state.ui.loading,
                actions: { ...state.ui.loading.actions, [action]: loading }
              }
            }
          }));
        },
        addError: (error: any) => {
          set((state) => ({
            ui: { ...state.ui, errors: [...state.ui.errors, error] }
          }));
        },
        clearError: (errorId: string) => {
          set((state) => ({
            ui: {
              ...state.ui,
              errors: state.ui.errors.filter((_, index) => index.toString() !== errorId)
            }
          }));
        },
        clearAllErrors: () => {
          set((state) => ({
            ui: { ...state.ui, errors: [] }
          }));
        },
        isModalVisible: (type: string) => {
          return !!get().ui.modals[type];
        },
        getModalData: (type: string) => {
          return get().ui.modals[type] || null;
        },
        isLoading: (action?: string) => {
          const { loading } = get().ui;
          if (action) {
            return loading.actions[action] || false;
          }
          return loading.global;
        },
        getErrors: () => {
          return get().ui.errors;
        },
      },
      
      // Settings state
      settings: {
        theme: 'dark',
        language: 'en',
        notifications: { enabled: true, sound: true, vibration: true },
        updateTheme: (theme) => {
          set((state) => ({
            settings: { ...state.settings, theme }
          }));
        },
        updateLanguage: (language) => {
          set((state) => ({
            settings: { ...state.settings, language }
          }));
        },
        updateNotifications: (notifications) => {
          set((state) => ({
            settings: { ...state.settings, notifications }
          }));
        },
      },
      
      // Rewards state
      rewards: {
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        updatedAt: null as string | null,
        unlockableApps: [],
        accelerateCard: null,
        earnFruits: (amount, source, metadata) => {
          set((state) => ({
            rewards: {
              ...state.rewards,
              balance: state.rewards.balance + amount,
              totalEarned: state.rewards.totalEarned + amount,
              updatedAt: new Date().toISOString(),
            }
          }));

          // Update shield configuration with new balance
          const newBalance = get().rewards.balance;
          FamilyControlsModule.updateShieldBalance(newBalance).catch((error) => {
            console.error('Failed to update shield balance after earning fruits:', error);
          });

          // Analytics: a completed focus session is the core-loop / retention signal.
          // earnFruits('focus_session') is the single choke point for every completion
          // path (live timer, manual entry, widget/Live Activity stop).
          if (source === 'focus_session') {
            const session = metadata?.sessionId
              ? get().focus.sessions.byId[metadata.sessionId]
              : undefined;
            AnalyticsTracker.track(
              'focus_session_completed',
              {
                duration_minutes: metadata?.duration ?? session?.duration,
                tag_id: session?.tagId,
                has_blocklist: get().blocklist.currentSelectionId != null,
                fruits_earned: amount,
              },
              { set: { total_focus_sessions: get().focus.sessions.allIds.length } }
            );
          }
        },
        spendFruits: (amount, purpose, metadata) => {
          set((state) => ({
            rewards: {
              ...state.rewards,
              // Balance can never drop below 0.
              balance: Math.max(0, state.rewards.balance - amount),
              totalSpent: state.rewards.totalSpent + amount,
              updatedAt: new Date().toISOString(),
            }
          }));

          // Update shield configuration with new balance
          const newBalance = get().rewards.balance;
          FamilyControlsModule.updateShieldBalance(newBalance).catch((error) => {
            console.error('Failed to update shield balance after spending fruits:', error);
          });

          // Analytics: closing the blocking economy loop (earn fruit → spend to unlock).
          // Fires when the user spends fruit to unlock app(s) — i.e. the unlock action
          // itself, not the unlock session expiring (that's endUnlock).
          if (purpose === 'app_unlock') {
            AnalyticsTracker.track('app_unlocked', {
              unlock_duration: metadata?.duration,
              fruit_cost: amount,
            });
          }
        },
        unlockApp: async (appId) => {
          const app = get().rewards.unlockableApps.find(app => app.id === appId);
          if (app) {
            set((state) => ({
              rewards: {
                ...state.rewards,
                // Balance can never drop below 0.
                balance: Math.max(0, state.rewards.balance - app.price),
                totalSpent: state.rewards.totalSpent + app.price,
                updatedAt: new Date().toISOString(),
                unlockableApps: state.rewards.unlockableApps.filter(a => a.id !== appId)
              }
            }));
            return true;
          }
          return false;
        },
        activateAccelerateCard: () => {
          const cost = 50;
          const balance = get().rewards.balance;
          if (balance < cost) {
            throw new Error(`Insufficient fruits. Required: ${cost}, Available: ${balance}`);
          }
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day
          get().rewards.spendFruits(cost, 'accelerate_card', { duration: '1 day' });
          set((state) => ({
            rewards: {
              ...state.rewards,
              accelerateCard: {
                activatedAt: now.toISOString(),
                expiresAt: expiresAt.toISOString(),
              },
            },
          }));
        },
        isAccelerateActive: () => {
          const card = get().rewards.accelerateCard;
          if (!card) return false;
          return new Date(card.expiresAt) > new Date();
        },
      },

      // Blocklist state
      blocklist: {
        settings: {
          blockedApps: {
            applicationTokens: [],
            categoryTokens: [],
            webDomainTokens: []
          },
          unlockCostPerMinute: 1, // 1 fruit per minute
          scheduleEnabled: false,
        },
        currentSelectionId: null,
        activeSessions: {
          byId: {},
          allIds: []
        },
        transactions: {
          byId: {},
          allIds: []
        },
        editHistory: {
          weekStart: getWeekStart().toISOString(),
          editsThisWeek: 0,
        },
        lastUnlockDuration: null,
        isAuthorized: false,
        authorizationStatus: 0, // 0 = notDetermined
        lastAuthCheck: null,

        // Blocklist actions
        checkAuthorizationStatus: async () => {
          try {
            console.log('🔍 Checking current Family Controls authorization status...');
            const status = await FamilyControlsModule.getAuthorizationStatus();
            const isAuthorized = status === 2; // 2 = approved

            set((state) => ({
              blocklist: {
                ...state.blocklist,
                isAuthorized,
                authorizationStatus: status,
                lastAuthCheck: new Date()
              }
            }));

            console.log('🔍 Current authorization status:', status, 'isAuthorized:', isAuthorized);
            return isAuthorized;
          } catch (error) {
            console.error('❌ Failed to check authorization status:', error);
            set((state) => ({
              blocklist: {
                ...state.blocklist,
                isAuthorized: false,
                authorizationStatus: 3, // 3 = unknown/error
                lastAuthCheck: new Date()
              }
            }));
            return false;
          }
        },

        requestAuthorization: async () => {
          try {
            console.log('🔐 Requesting Family Controls authorization...');
            const authorized = await FamilyControlsModule.requestAuthorization();

            // Get the actual status after requesting authorization
            const status = await FamilyControlsModule.getAuthorizationStatus();

            set((state) => ({
              blocklist: {
                ...state.blocklist,
                isAuthorized: authorized,
                authorizationStatus: status,
                lastAuthCheck: new Date()
              }
            }));

            console.log('🔐 Authorization result:', authorized, 'status:', status);
            return authorized;
          } catch (error) {
            console.error('❌ Failed to request authorization:', error);
            set((state) => ({
              blocklist: {
                ...state.blocklist,
                isAuthorized: false,
                authorizationStatus: 1, // 1 = denied
                lastAuthCheck: new Date()
              }
            }));
            return false;
          }
        },

        updateBlockedApps: async (selection: FamilyActivitySelection, metadata?: { applicationCount?: number; categoryCount?: number; webDomainCount?: number }, chargeFruit?: boolean) => {
          try {
            console.log('📱 Store: updateBlockedApps called');
            console.log('📱 Store: selection token:', selection);
            console.log('📱 Store: metadata:', metadata);
            console.log('📱 Store: chargeFruit:', chargeFruit);

            if (chargeFruit) {
              // Charge fruit cost for editing blocklist (weekly escalation)
              const editCost = get().blocklist.getBlocklistEditCost();
              const currentBalance = get().rewards.balance;
              console.log('📱 Store: Blocklist edit cost:', editCost, 'balance:', currentBalance);

              if (currentBalance < editCost) {
                throw new Error(`Insufficient fruits. Need ${editCost} but have ${currentBalance}.`);
              }

              // Deduct cost
              get().rewards.spendFruits(editCost, 'blocklist_edit', { editCost });

              // Update edit history
              const currentWeekStart = getWeekStart().toISOString();
              const { editHistory } = get().blocklist;
              const editsThisWeek = editHistory.weekStart === currentWeekStart
                ? editHistory.editsThisWeek + 1
                : 1; // new week, this is the first edit

              set((state) => ({
                blocklist: {
                  ...state.blocklist,
                  editHistory: {
                    weekStart: currentWeekStart,
                    editsThisWeek,
                  },
                },
              }));
            }

            const currentState = get();
            const currentSelectionId = currentState.blocklist.currentSelectionId;
            console.log('📱 Store: current stored selectionId:', currentSelectionId);
            console.log('📱 selection:', selection);

            // Always clear the internal blocklist before applying the new selection.
            // This avoids a bug where the picker overwrites the canonical blob
            // ('bittersweet-blocklist') before Save, causing unblockSelection-by-ID
            // to diff against the NEW selection instead of the OLD one — leaving
            // removed apps still in the internal blocklist.
            if (currentSelectionId) {
              console.log('📱 Store: Clearing internal blocklist before applying new selection');
              const unblockSuccess = await FamilyControlsModule.removeRestrictions();
              console.log('📱 Store: unblock result:', unblockSuccess);

              // Clear shield configuration when unblocking
              if (unblockSuccess) {
                await FamilyControlsModule.clearShieldConfiguration();
              }
            }

            // If selection is null or empty, clear the blocklist
            if (selection === null || selection === '') {
              console.log('📱 Store: Clearing blocklist - no new selection to apply');

              // Clear the stored selection
              set((state) => {
                console.log('📱 Store: Clearing stored blocklist state');
                return {
                  blocklist: {
                    ...state.blocklist,
                    currentSelectionId: null,
                    settings: {
                      ...state.blocklist.settings,
                      blockedApps: {
                        applicationTokens: [],
                        categoryTokens: [],
                        webDomainTokens: []
                      }
                    }
                  }
                };
              });

              // Sync to UserDefaults so native intent can re-block if needed
              WidgetService.syncCurrentSelectionId(null);

              // Clear shield configuration when clearing blocklist
              await FamilyControlsModule.clearShieldConfiguration();

              console.log('✅ Store: Blocklist cleared successfully');
              return;
            }

            // Apply restrictions using native module with the selection ID
            console.log('📱 Store: Calling FamilyControlsModule.applyRestrictions...');
            const success = await FamilyControlsModule.applyRestrictions(selection);
            console.log('📱 Store: applyRestrictions result:', success);

            // Configure shield with current fruit balance
            if (success) {
              const currentBalance = get().rewards.balance;
              console.log('📱 Store: Configuring shield with balance:', currentBalance);
              await FamilyControlsModule.updateShieldBalance(currentBalance);
            }

            if (success) {
              // Convert string token to legacy format for storage/display
              const legacySelection = {
                applicationTokens: metadata?.applicationCount ? [{
                  id: selection,
                  bundleIdentifier: 'selected.apps',
                  displayName: `${metadata.applicationCount} Selected Apps`
                }] : [],
                categoryTokens: metadata?.categoryCount ? [{
                  id: selection,
                  bundleIdentifier: 'selected.categories',
                  displayName: `${metadata.categoryCount} Selected Categories`
                }] : [],
                webDomainTokens: metadata?.webDomainCount ? [{
                  id: selection,
                  bundleIdentifier: 'selected.domains',
                  displayName: `${metadata.webDomainCount} Selected Domains`
                }] : []
              };

              console.log('📱 Store: Generated legacySelection:', legacySelection);
              console.log('📱 Store: Updating store state...');

              set((state) => {
                console.log('📱 Store: Current state before update:', state.blocklist.settings.blockedApps);
                const newState = {
                  blocklist: {
                    ...state.blocklist,
                    currentSelectionId: selection,
                    settings: {
                      ...state.blocklist.settings,
                      blockedApps: legacySelection
                    }
                  }
                };
                console.log('📱 Store: New state after update:', newState.blocklist.settings.blockedApps);
                console.log('📱 Store: Stored selectionId:', selection);
                return newState;
              });

              // Sync to UserDefaults so native intent can re-block if needed
              WidgetService.syncCurrentSelectionId(selection);

              // Verify the update
              console.log('📱 Store: Verifying update...');
              const updatedState = get();
              console.log('📱 Store: Final state:', updatedState.blocklist.settings.blockedApps);

              // Skip monitoring for now to avoid Swift crash
              // TODO: Implement proper monitoring once blocking is working
              console.log('📱 Store: Skipping monitoring to avoid crash (will implement later)');

              console.log('✅ Store: Blocked apps updated successfully');

              // Notify inner circle about blocklist edit (fire-and-forget)
              const groveState = get().grove;
              if (groveState.isActive && groveState.heartbeatSettings?.isEnabled) {
                groveState.notifyBlocklistEdit();
              }

              // Analytics: blocking adoption + the blocklist-vs-no-blocklist cohort.
              // ever_configured_blocklist is sticky; blocklist_app_count tracks the
              // current count so we can tell active blockers from set-and-emptied.
              AnalyticsTracker.track(
                'blocklist_configured',
                { app_count: metadata?.applicationCount ?? 0 },
                {
                  set: { blocklist_app_count: metadata?.applicationCount ?? 0 },
                  setOnce: { ever_configured_blocklist: true },
                }
              );
            } else {
              throw new Error('Failed to apply restrictions via native module');
            }
          } catch (error) {
            console.error('❌ Store: Failed to update blocked apps:', error);
            throw error;
          }
        },

        updateSettings: (settingsUpdate: Partial<BlocklistSettings>) => {
          console.log('⚙️ Updating blocklist settings:', settingsUpdate);
          set((state) => ({
            blocklist: {
              ...state.blocklist,
              settings: {
                ...state.blocklist.settings,
                ...settingsUpdate
              }
            }
          }));
        },

        requestUnlock: async (appTokens: any[], duration: number) => {
          try {
            const { blocklist, rewards } = get();
            const totalCost = duration * blocklist.settings.unlockCostPerMinute;

            // Check if user has enough fruits
            if (rewards.balance < totalCost) {
              console.log('❌ Insufficient fruits for unlock');
              return null;
            }



            console.log('🔓 Creating unlock session:', { duration, cost: totalCost });

            const sessionId = generateId();
            const startTime = new Date();
            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

            const unlockSession: UnlockSession = {
              id: sessionId,
              appTokens,
              startTime,
              endTime,
              duration,
              cost: totalCost,
              isActive: true,
              remainingTime: duration * 60
            };

            // Create unlock transaction
            const transaction: UnlockTransaction = {
              id: generateId(),
              sessionId,
              appTokens,
              duration,
              cost: totalCost,
              timestamp: new Date(),
              status: 'completed'
            };

            // Update state
            set((state) => ({
              blocklist: {
                ...state.blocklist,
                lastUnlockDuration: duration,
                activeSessions: {
                  byId: { ...state.blocklist.activeSessions.byId, [sessionId]: unlockSession },
                  allIds: [...state.blocklist.activeSessions.allIds, sessionId]
                },
                transactions: {
                  byId: { ...state.blocklist.transactions.byId, [transaction.id]: transaction },
                  allIds: [...state.blocklist.transactions.allIds, transaction.id]
                }
              }
            }));

            // Spend fruits
            get().rewards.spendFruits(totalCost, 'app_unlock', { sessionId, duration, appTokens });

            // Note: Actual unlocking is now handled by UnlockSnackbar using unblockSelection
            // This function just tracks the unlock session for accounting purposes

            console.log('✅ Unlock session created:', unlockSession);
            return unlockSession;
          } catch (error) {
            console.error('❌ Failed to create unlock session:', error);
            return null;
          }
        },

        endUnlock: (sessionId: string, reason: 'expired' | 'manual' = 'expired') => {
          console.log('🔒 Ending unlock session:', sessionId);
          const session = get().blocklist.activeSessions.byId[sessionId];

          if (session && session.isActive) {
            // Stop Live Activity if it exists
            if (session.liveActivityId) {
              console.log('🛑 Stopping Live Activity for session:', sessionId);
              LiveActivityService.stopUnlockCountdown(session.liveActivityId, reason);
            }

            if (session.notificationId) {
              Notifications.cancelScheduledNotificationAsync(session.notificationId).catch((error) => {
                console.error('Failed to cancel unlock expiration notification:', error);
              });
            }

            set((state) => ({
              blocklist: {
                ...state.blocklist,
                activeSessions: {
                  ...state.blocklist.activeSessions,
                  byId: {
                    ...state.blocklist.activeSessions.byId,
                    [sessionId]: { ...session, isActive: false, remainingTime: 0, notificationId: undefined }
                  }
                }
              }
            }));

            // Note: Re-blocking is now handled automatically by DeviceActivity schedule

            // Show idle focus Live Activity so user can start a new session from lock screen
            const focus = get().focus;
            const tagId = focus.lastSelectedTagId;
            const tag = tagId ? focus.tags.byId[tagId] : undefined;
            const tagLabel = tag ? `${tag.icon || '🎯'} ${tag.name}` : 'Focus';
            const lastDuration = tagId ? focus.lastDurationByTagId[tagId] : undefined;
            LiveActivityService.showIdleFocusActivity(tagLabel, tagId || undefined, lastDuration);

            console.log('🔒 Unlock session ended:', sessionId);
          }
        },

        checkActiveUnlocks: () => {
          const now = new Date();
          const { activeSessions } = get().blocklist;

          Object.values(activeSessions.byId).forEach(session => {
            if (session.isActive && now >= session.endTime) {
              console.log('⏰ Auto-ending expired unlock session:', session.id);
              get().blocklist.endUnlock(session.id);
            }
          });
        },

        getBlocklistEditCost: () => {
          const { editHistory } = get().blocklist;
          const currentWeekStart = getWeekStart().toISOString();

          // Reset count if we're in a new week
          if (editHistory.weekStart !== currentWeekStart) {
            return 1; // 2^0 = 1 (first edit of new week)
          }

          return Math.pow(2, editHistory.editsThisWeek); // 1, 2, 4, 8, 16...
        },

      }
    }),
      { name: 'bittersweet-store' }
    ),
    persistenceConfig
  )
);

/**
 * Typed hooks for accessing store slices
 */
export const useFocus = () => useAppStore((state) => state.focus);
export const useSettings = () => useAppStore((state) => state.settings);
export const useUI = () => useAppStore((state) => state.ui);
export const useRewards = () => useAppStore((state) => state.rewards);
export const useBlocklist = () => useAppStore((state) => state.blocklist);
export const useGrove = () => useAppStore((state) => state.grove);
export const useGroveActions = () => useAppStore((state) => ({
  fetchProfile: state.grove.fetchProfile,
  createProfile: state.grove.createProfile,
  updateProfile: state.grove.updateProfile,
  updatePrivacySettings: state.grove.updatePrivacySettings,
  uploadAvatar: state.grove.uploadAvatar,
  removeAvatar: state.grove.removeAvatar,
  toggleGroveActive: state.grove.toggleGroveActive,
  clearGroveError: state.grove.clearGroveError,
  resetGrove: state.grove.resetGrove,
  // Phase 2
  fetchFriends: state.grove.fetchFriends,
  removeFriend: state.grove.removeFriend,
  acceptFriendRequest: state.grove.acceptFriendRequest,
  rejectFriendRequest: state.grove.rejectFriendRequest,
  fetchFriendRequests: state.grove.fetchFriendRequests,
  fetchFeed: state.grove.fetchFeed,
  addReaction: state.grove.addReaction,
  removeReaction: state.grove.removeReaction,
  updateLastGroveVisit: state.grove.updateLastGroveVisit,
  generateInviteLink: state.grove.generateInviteLink,
  resolveInviteCode: state.grove.resolveInviteCode,
  // Phase 3
  fetchRankings: state.grove.fetchRankings,
  setRankingsPeriod: state.grove.setRankingsPeriod,
  fetchChallenges: state.grove.fetchChallenges,
  createChallenge: state.grove.createChallenge,
  acceptChallenge: state.grove.acceptChallenge,
  declineChallenge: state.grove.declineChallenge,
  updateMyHitsLocally: state.grove.updateMyHitsLocally,
}));

/**
 * Store actions hooks
 */
export const useFocusActions = () => useAppStore((state) => ({
  createSession: state.focus.createSession,
  updateSession: state.focus.updateSession,
  adjustSessionDuration: state.focus.adjustSessionDuration,
  deleteSession: state.focus.deleteSession,
  startSession: state.focus.startSession,
  completeSession: state.focus.completeSession,
  createCompletedSession: state.focus.createCompletedSession,
  setSelectedDate: state.focus.setSelectedDate,
  setViewMode: state.focus.setViewMode,
  goToPreviousWeek: state.focus.goToPreviousWeek,
  goToNextWeek: state.focus.goToNextWeek,
  goToCurrentWeek: state.focus.goToCurrentWeek,
  setLastSelectedTagId: state.focus.setLastSelectedTagId,
  setLastDurationForTag: state.focus.setLastDurationForTag,
  createTag: state.focus.createTag,
  updateTag: state.focus.updateTag,
  deleteTag: state.focus.deleteTag,
  reorderTags: state.focus.reorderTags,
  addGoal: state.focus.addGoal,
  updateGoal: state.focus.updateGoal,
  deleteGoal: state.focus.deleteGoal,
  concludeGoal: state.focus.concludeGoal,
  deleteBadge: state.focus.deleteBadge,
  reorderGoals: state.focus.reorderGoals,
  getActiveGoals: state.focus.getActiveGoals,
  shareTag: state.focus.shareTag,
  stopSharingTag: state.focus.stopSharingTag,
  resolveSharedTagCode: state.focus.resolveSharedTagCode,
  joinSharedTag: state.focus.joinSharedTag,
  leaveSharedTag: state.focus.leaveSharedTag,
  removeJoiner: state.focus.removeJoiner,
  fetchJoinerStats: state.focus.fetchJoinerStats,
}));

export const useUIActions = () => useAppStore((state) => ({
  showModal: state.ui.showModal,
  hideModal: state.ui.hideModal,
  setLoading: state.ui.setLoading,
  addError: state.ui.addError,
  clearError: state.ui.clearError,
  clearAllErrors: state.ui.clearAllErrors,
}));

export const useSettingsActions = () => useAppStore((state) => ({
  updateTheme: state.settings.updateTheme,
  updateLanguage: state.settings.updateLanguage,
  updateNotifications: state.settings.updateNotifications,
}));

export const useRewardsActions = () => useAppStore((state) => ({
  earnFruits: state.rewards.earnFruits,
  spendFruits: state.rewards.spendFruits,
  unlockApp: state.rewards.unlockApp,
}));

export const useBlocklistActions = () => useAppStore((state) => ({
  checkAuthorizationStatus: state.blocklist.checkAuthorizationStatus,
  requestAuthorization: state.blocklist.requestAuthorization,
  updateBlockedApps: state.blocklist.updateBlockedApps,
  updateSettings: state.blocklist.updateSettings,
  requestUnlock: state.blocklist.requestUnlock,
  endUnlock: state.blocklist.endUnlock,
  checkActiveUnlocks: state.blocklist.checkActiveUnlocks,
  getBlocklistEditCost: state.blocklist.getBlocklistEditCost,
}));

export const useBlocklistEditCost = () => useAppStore((state) => {
  const { editHistory } = state.blocklist;
  const currentWeekStart = getWeekStart().toISOString();
  const editsThisWeek = editHistory.weekStart === currentWeekStart
    ? editHistory.editsThisWeek
    : 0;
  const cost = Math.pow(2, editsThisWeek); // 1, 2, 4, 8, 16...
  return {
    cost,
    editsThisWeek,
    canAfford: state.rewards.balance >= cost,
    balance: state.rewards.balance,
  };
});

/**
 * Store selectors hooks
 */
export const useFocusSelectors = () => useAppStore((state) => ({
  getSessionById: (id: string) => state.focus.sessions.byId[id],
  getSessionsForDate: (date: Date) => {
    const sessions = Object.values(state.focus.sessions.byId);
    return sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate.toDateString() === date.toDateString();
    });
  },
  getSessionsForDateRange: (startDate: Date, endDate: Date) => {
    const sessions = Object.values(state.focus.sessions.byId);
    return sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  },
  getActiveSession: () => state.focus.currentSession.session,
  getTagById: (id: string) => state.focus.tags.byId[id],
  getAllTags: () => Object.values(state.focus.tags.byId),
  getCompletedSessions: () => Object.values(state.focus.sessions.byId)
      .filter(Boolean),
}));

/**
 * Store utilities
 */
export const getStoreState = () => useAppStore.getState();
export const subscribeToStore = useAppStore.subscribe;

/**
 * Backfill missing colors and goals for existing tags.
 * Must only be called AFTER the persist middleware has finished rehydrating.
 */
function populateDefaults() {
  try {
    // Backfill color for existing tags that don't have one
    const defaultColorMap: Record<string, string> = {
      'Work': CLASSIC_TAG_COLORS.blue,
      'Study': CLASSIC_TAG_COLORS.amber,
      'Reading': CLASSIC_TAG_COLORS.orange,
      'Exercise': CLASSIC_TAG_COLORS.green,
      'Creative': CLASSIC_TAG_COLORS.purple,
      'Personal': CLASSIC_TAG_COLORS.skyBlue,
    };
    const currentState = getStoreState();
    for (const tagId of currentState.focus.tags.allIds) {
      const tag = currentState.focus.tags.byId[tagId];
      if (tag && !tag.color) {
        currentState.focus.updateTag(tagId, { color: defaultColorMap[tag.name] || DEFAULT_TAG_COLOR });
      }
    }

    // Backfill deactivated goals for tags that don't have one (1:1 tag-goal relationship)
    const refreshedState = getStoreState();
    const existingGoalTagIds = new Set(
      refreshedState.focus.goals.allIds
        .map((id: string) => refreshedState.focus.goals.byId[id]?.tagId)
        .filter(Boolean)
    );
    for (const tagId of refreshedState.focus.tags.allIds) {
      const tag = refreshedState.focus.tags.byId[tagId];
      if (!tag || tag.deletedAt) continue;
      if (existingGoalTagIds.has(tagId)) continue;

      console.log(`🎯 Backfilling deactivated goal for tag: ${tag.name}`);
      refreshedState.focus.addGoal({
        userId: 'dev-user',
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
        lastResetDate: new Date(),
      } as any);
    }

    console.log('✅ Store initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing store:', error);
  }
}

/**
 * Default tags seeded once on a fresh install (no login session yet). A brand-new
 * local user starts with these four categories regardless of whether they create a
 * tag during onboarding. Returning/signed-in users are never seeded here — their
 * tags come from the cloud pull.
 */
const DEFAULT_TAGS: Array<{ name: string; icon: string; color: string }> = [
  { name: 'Exercise', icon: '🏋️', color: CLASSIC_TAG_COLORS.green },
  { name: 'Study', icon: '📚', color: CLASSIC_TAG_COLORS.amber },
  { name: 'Work', icon: '💼', color: CLASSIC_TAG_COLORS.blue },
  { name: 'Mindful Rest', icon: '🧘', color: CLASSIC_TAG_COLORS.purple },
];

export function seedDefaultTags() {
  // Seed SYNCHRONOUSLY — do not defer to onFinishHydration. This runs only from the
  // fresh-install branch of restoreSession, before the user can possibly sign in.
  // Deferring would let a sign-in's cloud-pull clear local data first, after which a
  // late seed callback would inject stray default tags into the signed-in account.
  // On a genuine fresh install AsyncStorage is empty, so there is no persisted data to
  // clobber, and the custom persist `merge` returns currentState when storage is empty
  // — so these tags survive a racing rehydration.
  try {
    for (const tag of DEFAULT_TAGS) {
      // Skip any default whose name already exists (defensive against double-seed).
      const state = getStoreState();
      const exists = state.focus.tags.allIds.some(
        (id) => state.focus.tags.byId[id]?.name === tag.name && !state.focus.tags.byId[id]?.deletedAt
      );
      if (exists) continue;
      state.focus.createTag(tag);
    }
    console.log('🌱 Seeded default tags for fresh install');
  } catch (error) {
    console.error('❌ Error seeding default tags:', error);
  }
}

/**
 * Store initialization — waits for persist rehydration before populating defaults.
 * This prevents default tags from being written to storage before real user data
 * has been loaded, which was the root cause of the data-nuke bug.
 */
export function initializeStore() {
  console.log('🔧 Initializing store...');

  if (useAppStore.persist.hasHydrated()) {
    populateDefaults();
  } else {
    useAppStore.persist.onFinishHydration(() => {
      populateDefaults();
    });
  }
}

// Initialize store on module load
try {
  initializeStore();
} catch (error) {
  console.error('❌ Failed to initialize store:', error);
}

/**
 * Resets the entire store to its default/empty state.
 * @param keepAuth - If true, the auth slice state is preserved (useful for sign-in refresh).
 */
export const clearAllStoreData = (keepAuth: boolean = false) => {
  console.log('🧹 Clearing all local store data (keepAuth:', keepAuth, ')');
  const s = useAppStore.getState();
  useAppStore.setState({
    focus: {
      ...s.focus,
      sessions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      tags: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      goals: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      badges: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      currentSession: { session: null, isRunning: false, remainingTime: 0, startedAt: null },
      lastSelectedTagId: null,
      lastDurationByTagId: {},
      sharedTagStats: { joinerStats: [], loading: false, currentTagId: null },
    },
    rewards: {
      ...s.rewards,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      updatedAt: null,
      unlockableApps: [],
      accelerateCard: null,
    },
    blocklist: {
      ...s.blocklist,
      settings: {
        blockedApps: {
          applicationTokens: [],
          categoryTokens: [],
          webDomainTokens: []
        },
        unlockCostPerMinute: 1,
        scheduleEnabled: false,
      },
      currentSelectionId: null,
      activeSessions: { byId: {}, allIds: [] },
      transactions: { byId: {}, allIds: [] },
      editHistory: {
        weekStart: getWeekStart().toISOString(),
        editsThisWeek: 0,
      },
      lastUnlockDuration: null,
      isAuthorized: false,
      authorizationStatus: 0,
      lastAuthCheck: null,
    },
    ...(keepAuth ? {} : {
      auth: {
        ...s.auth,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastSignedInUserId: null,
      }
    }),
    subscription: {
      ...s.subscription,
      tier: 'free',
      expiresAt: null,
      productId: null,
      isLoading: false,
      error: null,
    },
    sync: {
      ...s.sync,
      lastSyncTime: null,
      isSyncing: false,
      syncError: null,
      offlineQueueSize: 0,
      syncStatus: 'idle',
    },
    grove: {
      ...s.grove,
      profile: null,
      privacySettings: null,
      isActive: false,
      isLoading: false,
      error: null,
      lastGroveVisit: null,
      heartbeatSettings: null,
      friends: [],
      feed: [],
      rankingsWeek: [],
      rankingsMonth: [],
      challenges: [],
    },
    referral: {
      ...s.referral,
      referralCode: null,
      referralCount: 0,
      claimedTier: 0,
      isLoading: false,
    },
    ui: {
      ...s.ui,
      modals: {},
      loading: { global: false, actions: {} },
      errors: [],
    }
  });
};
