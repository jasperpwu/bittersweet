/**
 * Unified Zustand store - Focus-centric architecture
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import {
  FocusSession,
  SessionTag,
  CreateSessionInput,
  FamilyActivitySelection,
  UnlockSession,
  UnlockTransaction,
  BlocklistSettings,
  Purchase,
  CustomReward,
} from '../types/models';
import { pickTipId } from '../config/tips';
import { sliderThemeCostForUser, themeProductId } from '../config/sliderThemes';
import { customRewardProductId } from '../config/customRewards';
import { FamilyControlsModule } from '../modules/BitterSweetFamilyControls';
import { LiveActivityService } from '../services/LiveActivityService';
import { WidgetService } from '../services/WidgetService';
import { FocusGoal, WeeklyCoachReport, Todo, TodoRecurrence } from './types';
import { nextOccurrence, startOfDay } from '../utils/todoRecurrence';
import { persistenceConfig, persistStateNow } from './middleware/persistence';
import { computeBadgeStats } from '../utils/badgeStats';
import {
  fruitsForRating,
  shouldAutoRate,
  suggestRating,
  type RatingSource,
} from '../utils/focusRating';
import {
  startSessionMotionRecording,
  getMotionPermissionStatus,
  getSessionMotionSnapshot,
} from '../services/motionInsights';
import { useUnifiedStore } from './unified-store';
import { CLASSIC_TAG_COLORS, DEFAULT_TAG_COLOR } from '../config/tagColors';
import * as Notifications from 'expo-notifications';
import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { SubscriptionSlice, createSubscriptionSlice } from './slices/subscriptionSlice';
import { SyncSlice, createSyncSlice } from './slices/syncSlice';
import { GroveSlice, createGroveSlice } from './slices/groveSlice';
import { ReferralSlice, createReferralSlice } from './slices/referralSlice';
import { AnalyticsTracker } from '../services/analytics';
import { SyncService } from '../services/sync/SyncService';
import {
  sessionToRow,
  tagToRow,
  defaultSetupTasks,
  normalizeSetupTasks,
  SETUP_TASK_REWARD,
  type SetupTaskId,
  type SetupTasks,
} from '../services/sync/SyncMapper';

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

    // TODOs (lightweight task planning, surfaced in Journal)
    todos: {
      byId: Record<string, Todo>;
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
    applyFocusRating: (id: string, rating: number, source: RatingSource) => void;
    autoRateSessionFromMotion: (id: string) => Promise<void>;
    deleteSession: (id: string) => void;
    restoreSession: (session: FocusSession) => void;
    startSession: (id: string) => void;
    completeSession: (id?: string) => void;
    createCompletedSession: (params: {
      id?: string;
      startTime: Date;
      endTime: Date;
      duration: number;
      targetDuration: number;
      tagId: string;
      secondaryTagId?: string;
      notes?: string;
      isManualEntry?: boolean;
    }) => FocusSession;
    importHealthKitWorkouts: (
      workouts: {
        uuid: string;
        startDate: Date;
        endDate: Date;
        durationMinutes: number;
        wasUserEntered: boolean;
      }[],
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
    createTag: (
      tag: Omit<SessionTag, 'id' | 'usageCount' | 'sortOrder' | 'createdAt' | 'updatedAt'>
    ) => SessionTag;
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

    // TODO management
    createTodo: (input: {
      name: string;
      tagId: string;
      startAt?: Date;
      startHasTime?: boolean;
      deadlineAt?: Date;
      deadlineHasTime?: boolean;
      durationMinutes?: number;
      notes?: string;
      recurrence?: TodoRecurrence;
    }) => Todo;
    updateTodo: (
      id: string,
      updates: Partial<
        Pick<
          Todo,
          | 'name'
          | 'tagId'
          | 'startAt'
          | 'startHasTime'
          | 'deadlineAt'
          | 'deadlineHasTime'
          | 'durationMinutes'
          | 'notes'
          | 'recurrence'
        >
      >
    ) => void;
    toggleTodo: (id: string) => void;
    // Set a todo's completed state to an explicit value (vs toggleTodo's flip).
    // Used when adopting a Home Screen widget toggle, where the desired state is
    // known up front.
    setTodoCompleted: (id: string, completed: boolean) => void;
    deleteTodo: (id: string) => void;
    restoreTodo: (id: string) => void;
    // Persist a manual order for a subset of todos (e.g. one tag's incomplete
    // todos reordered under the running timer). orderedIds is the visible subset
    // in its new order — other todos are untouched.
    reorderTodos: (orderedIds: string[]) => void;
    // Google Tasks-style rollover: advance every recurring todo whose current
    // occurrence day has passed to its next occurrence on/after today. A
    // completed occurrence is first snapshotted as a plain completed todo so
    // Journal/Completed history survives the roll. Idempotent.
    rollRecurringTodos: () => void;

    // Badges
    badges: {
      byId: Record<string, any>;
      allIds: string[];
      loading: boolean;
      error: string | null;
      lastUpdated: Date | null;
    };

    // AI Focus Coach — weekly reports (synced like badges)
    coachReports: {
      byId: Record<string, WeeklyCoachReport>;
      allIds: string[];
      loading: boolean;
      error: string | null;
      lastUpdated: Date | null;
    };
    upsertCoachReport: (report: WeeklyCoachReport) => void;
    deleteCoachReport: (id: string) => void;
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
    updateNotifications: (settings: {
      enabled: boolean;
      sound: boolean;
      vibration: boolean;
    }) => void;
  };

  // Rewards
  rewards: {
    balance: number;
    totalEarned: number;
    totalSpent: number;
    updatedAt: string | null;
    unlockableApps: any[];
    accelerateCard: { activatedAt: string; expiresAt: string } | null;
    // Daily unlock-minutes history (YYYY-MM-DD -> total minutes actually used that day).
    // Lives on rewards (not blocklist) so it rides the rewards row's cloud sync and
    // survives reinstalls. Feeds the unlock time trend chart in the unlock modal.
    unlockHistory: Record<string, number>;
    // One-time setup tasks (set up widget / set a goal), each worth SETUP_TASK_REWARD fruits.
    tasks: SetupTasks;
    // Fruit-store purchase history (accelerate cards, usage tips). List-synced to
    // the `purchases` table, same pattern as badges/coach reports.
    purchases: { byId: Record<string, Purchase>; allIds: string[] };
    // User-defined rewards for the store's Custom tab. List-synced to the
    // `custom_rewards` table. Definitions outlive their purchase (history rows
    // resolve name/emoji from here); the catalog hides bought ones.
    customRewards: { byId: Record<string, CustomReward>; allIds: string[] };
    earnFruits: (amount: number, source: string, metadata?: any) => void;
    spendFruits: (amount: number, purpose: string, metadata?: any) => void;
    unlockApp: (appId: string) => Promise<boolean>;
    activateAccelerateCard: () => void;
    // Spend fruits on a usage tip: picks a tip not yet purchased, records the
    // purchase with its tipId, and returns the tipId so the UI can show that
    // tip's message. Throws on insufficient balance or when the whole catalog
    // is already owned (UI should pre-check both).
    purchaseTip: () => string;
    // Spend fruits on a slider theme. Ownership derives from purchase history
    // (product_id `theme_<id>`), so this only records the purchase — applying
    // the theme is a device-local preference (unified store `sliderThemeId`).
    // Throws on insufficient balance or when the theme is already owned.
    purchaseTheme: (themeId: string) => void;
    // Append a purchase record (internal helper for the product purchase actions).
    addPurchase: (
      productId: Purchase['productId'],
      cost: number,
      metadata?: { tipId?: string }
    ) => void;
    // Create a custom reward for the Custom tab (name trimmed, cost clamped to
    // a positive integer). Returns the new reward's id.
    addCustomReward: (name: string, cost: number, emoji?: string) => string;
    // Remove an un-bought custom reward from the catalog. Dropping the id from
    // byId/allIds lets the sync middleware enqueue the soft delete.
    deleteCustomReward: (rewardId: string) => void;
    // Spend fruits on a custom reward. Ownership derives from purchase history
    // (product_id `custom_<id>`), which is what hides it from the catalog.
    // Throws on insufficient balance or when already bought.
    purchaseCustomReward: (rewardId: string) => void;
    // Attach/replace the photo on a bought item's purchase row. Bumps
    // updatedAt so per-row LWW carries the photo through sync.
    setPurchasePhoto: (purchaseId: string, photoUrl: string) => void;
    isAccelerateActive: () => boolean;
    // Mark a setup task's prerequisite as satisfied (sticky). Does NOT award fruits and
    // does NOT bump updatedAt (see claimTask / sync notes).
    markTaskSetup: (taskId: SetupTaskId) => void;
    // Backfill everSetup from current live state (existing users with an active goal /
    // installed widget can claim right away). Widget detection is async and lives in the
    // layout; this covers the goal side from the store.
    reconcileSetupTasks: () => void;
    // Award SETUP_TASK_REWARD fruits for a set-up-but-unclaimed task. Returns false if
    // not eligible (not set up yet, or already claimed).
    claimTask: (taskId: SetupTaskId) => boolean;
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
    updateBlockedApps: (
      selection: FamilyActivitySelection,
      metadata?: { applicationCount?: number; categoryCount?: number; webDomainCount?: number },
      chargeFruit?: boolean
    ) => Promise<void>;
    updateSettings: (settings: Partial<BlocklistSettings>) => void;
    requestUnlock: (appTokens: any[], duration: number) => Promise<UnlockSession | null>;
    endUnlock: (sessionId: string, reason?: 'expired' | 'manual', endedAtMs?: number) => void;
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

// Compact time-ordered id: base36 ms timestamp + 10 random base36 chars.
// The timestamp prefix keeps ids lexicographically chronological (right-edge
// B-tree inserts in Postgres); 10 random chars (~3.6e15) rules out cross-user
// collisions within a millisecond at any realistic scale. The Swift widget
// stop path (SessionIntent.swift generateCompactId) mirrors this format —
// keep the two in sync.
const generateId = () => {
  const timestamp = Date.now().toString(36);
  let randomStr = '';
  for (let i = 0; i < 10; i++) {
    randomStr += Math.floor(Math.random() * 36).toString(36);
  }
  return `${timestamp}-${randomStr}`;
};

// Todos with no start time get a sortOrder above this base so they always sort
// after any realistically-dated timed todo (timed keys are minutes-since-epoch,
// ~29M now and well under 2B until ~year 5800). Keeps the default order
// chronological: timed first (by start), untimed last (by creation).
const TODO_UNTIMED_SORT_BASE = 2_000_000_000;

/**
 * Recompute and push the Home Screen TODO widget list after a todo mutation, so
 * the widget reflects changes immediately instead of waiting for the next
 * app-foreground sync. Lazy-required to avoid a circular import (widgetTodos
 * reads useAppStore from this module); best-effort, never throws into the store.
 */
const syncTodosWidget = () => {
  try {
    require('../services/widgetTodos').syncWidgetTodos();
  } catch (error) {
    console.error('📱 [Widget] Failed to sync todos to widget:', error);
  }
};

/**
 * Push a freshly-created/updated session straight to the sync queue, bypassing the
 * 2s debounced sync middleware. createCompletedSession is routinely followed by an
 * immediate force-quit (finish → summary screen → user swipes the app away);
 * persistStateNow() already saves the session to disk, but without this the cloud
 * upsert would only be enqueued ~2s later by the middleware, so a quit inside that
 * window leaves the session local-only — and the cold-start merge can't recover it
 * (the middleware diffs by reference against a baseline that already holds the row),
 * so it's lost on reinstall. Enqueue the tag(s) first (focus_sessions.tag_id /
 * secondary_tag_id FK), then the session, then flush. Idempotent: the queue dedupes
 * by id and the middleware's later diff is a harmless duplicate upsert. No-ops when
 * unauthenticated (e.g. widget adoption racing ahead of onAuthStateChange) — the
 * triggerSync reconcile then pushes it once auth lands.
 */
/**
 * Tell the user their change is safely queued when an immediate sync attempt
 * couldn't reach the cloud because the device is offline. The write is already
 * persisted (AsyncStorage sync queue) and the connectivity-restore / foreground /
 * cold-start flush paths deliver it once online — this toast just makes that
 * visible instead of failing silently. Only fires when NetInfo confirms we're
 * offline: other flush failures (RLS, FK) would make "no connection" a lie, and
 * those are already logged by flush. Lazy requires keep the store module free of
 * UI/i18n imports at init time.
 */
async function notifySyncPendingOffline(): Promise<void> {
  try {
    const NetInfo = require('@react-native-community/netinfo').default;
    const net = await NetInfo.fetch();
    const online = net.isConnected === true && net.isInternetReachable !== false;
    if (online) return;
    const { showToast } = require('../components/ui/Toast');
    const i18n = require('../i18n').default;
    showToast(i18n.t('common.offlineSyncPending'), 'neutral', undefined, 3500);
  } catch (error) {
    console.warn('[notifySyncPendingOffline] failed:', error);
  }
}

function enqueueSessionNow(state: any, session: FocusSession): void {
  if (!state.auth?.isAuthenticated || !state.auth?.user?.id) return;
  const userId = state.auth.user.id;
  void (async () => {
    try {
      const primaryTag = state.focus.tags.byId[session.tagId];
      if (primaryTag) {
        await SyncService.enqueue('session_tags', 'upsert', tagToRow(primaryTag, userId));
      }
      if (session.secondaryTagId && session.secondaryTagId !== session.tagId) {
        const secondaryTag = state.focus.tags.byId[session.secondaryTagId];
        if (secondaryTag) {
          await SyncService.enqueue('session_tags', 'upsert', tagToRow(secondaryTag, userId));
        }
      }
      await SyncService.enqueue('focus_sessions', 'upsert', sessionToRow(session, userId));
      const result = await SyncService.flush();
      console.log(
        `[enqueueSessionNow] ${session.id} — flushed:${result.flushed} failed:${result.failed}`
      );
      // flushed === 0 covers the skipped-flush case (no auth session available,
      // e.g. offline with an expired access token) — the rows are still queued.
      if (result.failed > 0 || result.flushed === 0) {
        void notifySyncPendingOffline();
      }
    } catch (error) {
      console.error('[enqueueSessionNow] failed:', error);
      void notifySyncPendingOffline();
    }
  })();
}

/**
 * Soft-delete a session in the cloud immediately, bypassing the 2s debounced sync
 * middleware — the delete equivalent of enqueueSessionNow. deleteSession only mutates
 * the store, so the middleware diff is normally what enqueues the soft_delete ~2s later;
 * a force-quit inside that window leaves the deletion local-only, and the next cold-start
 * merge then resurrects the row (remote still has it, merge unions remote with local).
 * Enqueuing + flushing here makes the deletion durable at the moment it happens.
 * Idempotent (queue dedupes by id); no-ops when unauthenticated.
 */
function enqueueSessionDeleteNow(state: any, sessionId: string): void {
  if (!state.auth?.isAuthenticated || !state.auth?.user?.id) return;
  void (async () => {
    try {
      await SyncService.enqueue('focus_sessions', 'soft_delete', { id: sessionId });
      const result = await SyncService.flush();
      console.log(
        `[enqueueSessionDeleteNow] ${sessionId} — flushed:${result.flushed} failed:${result.failed}`
      );
      if (result.failed > 0 || result.flushed === 0) {
        void notifySyncPendingOffline();
      }
    } catch (error) {
      console.error('[enqueueSessionDeleteNow] failed:', error);
      void notifySyncPendingOffline();
    }
  })();
}

// Fruit reward curve. Control points are [minutes, fruits]; reward scales
// smoothly between them by linear interpolation, and past the last point the
// final segment's slope continues so longer set durations keep earning. Tuned
// so the per-minute reward rate is steepest in the 30–60 min sweet spot.
const FRUIT_CURVE_POINTS: readonly (readonly [number, number])[] = [
  [5, 1],
  [30, 5],
  [60, 12],
  [90, 16],
];

/**
 * Whole fruits for N focus minutes via piecewise-linear interpolation of
 * FRUIT_CURVE_POINTS (rounded; the final segment is extrapolated beyond 90 min).
 * Reward starts at the first anchor — 5 min → 1 🍎, nothing before — then grows
 * smoothly, so fruits accrue at irregular minutes rather than on fixed 5-min
 * marks (no "stop on the 5-minute boundary" pressure).
 */
export const fruitsForMinutes = (minutes: number): number => {
  const pts = FRUIT_CURVE_POINTS;
  const m = Math.max(0, minutes);
  if (m < pts[0][0]) return 0; // reward begins at the first anchor (5 min → 1 🍎)
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (m <= x1) return Math.round(y0 + ((m - x0) / (x1 - x0)) * (y1 - y0));
  }
  const [x0, y0] = pts[pts.length - 2];
  const [x1, y1] = pts[pts.length - 1];
  return Math.round(y1 + (m - x1) * ((y1 - y0) / (x1 - x0)));
};

export const calculateFruitsEarnedForDuration = (
  duration: number,
  targetDuration: number = duration,
  multiplier: number = 1
) => {
  const earnedMinutes = Math.max(0, Math.floor(duration));
  // "Over time" beyond the set duration is a visual count-up only — cap counted
  // minutes at the target so it earns no extra fruits.
  const countedMinutes = Math.min(earnedMinutes, Math.max(0, Math.floor(targetDuration)));
  return fruitsForMinutes(countedMinutes) * multiplier;
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
            lastUpdated: null,
          },
          goals: {
            byId: {},
            allIds: [],
            loading: false,
            error: null,
            lastUpdated: null,
          },
          todos: {
            byId: {},
            allIds: [],
            loading: false,
            error: null,
            lastUpdated: null,
          },
          badges: {
            byId: {},
            allIds: [],
            loading: false,
            error: null,
            lastUpdated: null,
          },
          coachReports: {
            byId: {},
            allIds: [],
            loading: false,
            error: null,
            lastUpdated: null,
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
                },
              },
            }));

            // Calculate and award fruits (duration curve, capped at the set duration)
            const fruitsEarned = calculateFruitsEarnedForDuration(
              duration,
              duration,
              accelerateMultiplier
            );
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
                        },
                      },
                    },
                  },
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
            const nextAdjustedDuration = Math.max(
              0,
              Math.min(actualDuration, Math.round(adjustedDuration))
            );
            const targetDuration = session.initialSetDuration ?? session.duration;
            const adjustMultiplier =
              session.accelerateMultiplier ?? (get().rewards.isAccelerateActive() ? 2 : 1);
            const previousBaseFruits = session.isManualEntry
              ? 0
              : calculateFruitsEarnedForDuration(
                  previousAdjustedDuration,
                  targetDuration,
                  adjustMultiplier
                );
            const nextBaseFruits = session.isManualEntry
              ? 0
              : calculateFruitsEarnedForDuration(
                  nextAdjustedDuration,
                  targetDuration,
                  adjustMultiplier
                );
            const previousFruits =
              session.awardedFruits ??
              (session.focusRating != null
                ? fruitsForRating(previousBaseFruits, session.focusRating)
                : previousBaseFruits);
            const nextFruits =
              session.focusRating != null
                ? fruitsForRating(nextBaseFruits, session.focusRating)
                : nextBaseFruits;
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
                      accelerateMultiplier: adjustMultiplier,
                      baseFruits: nextBaseFruits,
                      awardedFruits: nextFruits,
                      updatedAt: new Date(),
                    },
                  },
                },
              },
              rewards:
                fruitDelta === 0
                  ? state.rewards
                  : {
                      ...state.rewards,
                      // Balance can never drop below 0 (fruitDelta may be negative).
                      balance: Math.max(0, state.rewards.balance + fruitDelta),
                      totalEarned: Math.max(0, state.rewards.totalEarned + fruitDelta),
                      updatedAt: new Date().toISOString(),
                    },
            }));

            if (fruitDelta !== 0) {
              const newBalance = get().rewards.balance;
              FamilyControlsModule.updateShieldBalance(newBalance).catch((error) => {
                console.error('Failed to update shield balance after session adjustment:', error);
              });
            }

            // Duration change alters this session's challenge contribution — recompute.
            get()
              .grove.recomputeChallengeHitsForTag(session.tagId)
              .catch(() => {});
            if (session.secondaryTagId && session.secondaryTagId !== session.tagId) {
              get()
                .grove.recomputeChallengeHitsForTag(session.secondaryTagId)
                .catch(() => {});
            }
          },

          // Apply a 1–5★ focus rating, scaling the session's fruit reward by the
          // rating multiplier. Idempotent: re-rating reconciles against the amount
          // already credited (awardedFruits), so it can be called repeatedly as the
          // suggestion lands and the user edits. Mirrors adjustSessionDuration's
          // fruit-delta handling (balance/totalEarned clamped ≥ 0 + shield sync).
          applyFocusRating: (sessionId, rating, source) => {
            const session = get().focus.sessions.byId[sessionId];
            if (!session) return;

            // Base = fruits before any rating discount. Fall back to recomputing from
            // duration for sessions created before this field existed.
            const baseFruits =
              session.baseFruits ??
              (session.isManualEntry
                ? 0
                : calculateFruitsEarnedForDuration(
                    session.adjustedDuration ?? session.duration,
                    session.initialSetDuration ?? session.duration,
                    session.accelerateMultiplier ?? 1
                  ));
            const target = fruitsForRating(baseFruits, rating);
            const alreadyAwarded = session.awardedFruits ?? baseFruits;
            const fruitDelta = target - alreadyAwarded;

            set((state) => ({
              focus: {
                ...state.focus,
                sessions: {
                  ...state.focus.sessions,
                  byId: {
                    ...state.focus.sessions.byId,
                    [sessionId]: {
                      ...session,
                      focusRating: rating,
                      ratingSource: source,
                      baseFruits,
                      awardedFruits: target,
                      updatedAt: new Date(),
                    },
                  },
                },
              },
              rewards:
                fruitDelta === 0
                  ? state.rewards
                  : {
                      ...state.rewards,
                      balance: Math.max(0, state.rewards.balance + fruitDelta),
                      totalEarned: Math.max(0, state.rewards.totalEarned + fruitDelta),
                      updatedAt: new Date().toISOString(),
                    },
            }));

            if (fruitDelta !== 0) {
              FamilyControlsModule.updateShieldBalance(get().rewards.balance).catch((error) => {
                console.error('Failed to update shield balance after focus rating:', error);
              });
            }
          },

          // Rate a completed session from historical Core Motion data, with no UI.
          // Used by every completion surface that skips the summary modal (widget /
          // Live Activity / Apple Watch stops adopted on foreground) and, via the
          // modal, by the in-app flow. Mirrors the modal's fallbacks: unrateable
          // sessions (too short / manual), missing permission, or any read failure
          // get the full reward (5★, no penalty). Never prompts for the Motion &
          // Fitness permission — priming is the summary modal's job. No-ops if the
          // session is already rated.
          autoRateSessionFromMotion: async (sessionId) => {
            const session = get().focus.sessions.byId[sessionId];
            if (!session || session.focusRating != null) return;

            const applyFullRating = () => {
              get().focus.updateSession(sessionId, {
                motionSummary: {
                  signal: 'none',
                  profile: 'unknown',
                  recorder: null,
                  activity: null,
                  steps: null,
                },
              });
              get().focus.applyFocusRating(sessionId, 5, 'suggested');
            };

            if (
              !shouldAutoRate({
                durationMinutes: session.duration,
                isManualEntry: session.isManualEntry,
              })
            ) {
              applyFullRating();
              return;
            }

            try {
              const status = await getMotionPermissionStatus();
              if (status !== 'granted') {
                applyFullRating();
                return;
              }
              const snapshot = await getSessionMotionSnapshot(
                new Date(session.startTime).getTime(),
                new Date(session.endTime).getTime()
              );
              get().focus.updateSession(sessionId, { motionSummary: snapshot });
              const tag = session.tagId ? get().focus.tags.byId[session.tagId] : null;
              get().focus.applyFocusRating(
                sessionId,
                suggestRating(tag?.activityType, snapshot),
                'suggested'
              );
            } catch {
              applyFullRating();
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
              const fruitsToDeduct =
                sessionToDelete && !sessionToDelete.isManualEntry
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
                    allIds: state.focus.sessions.allIds.filter((id) => id !== sessionId),
                  },
                },
                rewards: {
                  ...state.rewards,
                  // Never let the balance (or lifetime total) go negative.
                  balance: Math.max(0, state.rewards.balance - fruitsToDeduct),
                  totalEarned: Math.max(0, state.rewards.totalEarned - fruitsToDeduct),
                  updatedAt: new Date().toISOString(),
                },
              };
            });

            if (sessionToDelete) {
              console.log('🗑️ Session deleted and corresponding rewards removed:', sessionId);

              // Persist the removal locally and push the soft-delete to the cloud right
              // away. Like createCompletedSession, deleteSession can be followed by an
              // immediate force-quit; without this the deletion only lives in memory until
              // the debounced persist/sync (~2s) fires, so a quit strands it and the next
              // cold-start merge resurrects the row from the cloud. See enqueueSessionDeleteNow.
              persistStateNow(get());
              enqueueSessionDeleteNow(get(), sessionId);

              // Update shield configuration with new balance after deletion
              const newBalance = get().rewards.balance;
              const focusActive = get().focus.currentSession.isRunning;
              FamilyControlsModule.updateShieldBalance(newBalance, focusActive).catch((error) => {
                console.error('Failed to update shield balance after deleting session:', error);
              });

              // Removing the session changes challenge hits for its tag — recompute.
              get()
                .grove.recomputeChallengeHitsForTag(sessionToDelete.tagId)
                .catch(() => {});
              if (
                sessionToDelete.secondaryTagId &&
                sessionToDelete.secondaryTagId !== sessionToDelete.tagId
              ) {
                get()
                  .grove.recomputeChallengeHitsForTag(sessionToDelete.secondaryTagId)
                  .catch(() => {});
              }
            }
          },

          // Exact inverse of deleteSession, for the delete toast's Undo. Re-inserts
          // the captured session and re-grants the fruits deleteSession deducted, then
          // makes the restore durable: persistStateNow + enqueueSessionNow re-upserts the
          // row (sessionToRow now emits deleted_at:null, un-tombstoning the cloud row the
          // soft_delete created), refreshes the shield balance, and recomputes challenge
          // hits for the session's tag(s). Idempotent — no-ops if the id is already present.
          restoreSession: (session) => {
            if (get().focus.sessions.byId[session.id]) return;
            console.log('♻️ Restoring session:', session.id);

            // Mirror deleteSession's deduction rule exactly so we add back precisely
            // what was removed (manual entries earned/deducted 0).
            const fruitsToReAdd = !session.isManualEntry
              ? calculateFruitsEarnedForDuration(
                  session.adjustedDuration ?? session.duration ?? 0,
                  session.initialSetDuration ?? session.duration ?? 0,
                  session.accelerateMultiplier ?? 1
                )
              : 0;

            set((state) => ({
              focus: {
                ...state.focus,
                sessions: {
                  ...state.focus.sessions,
                  byId: { ...state.focus.sessions.byId, [session.id]: session },
                  allIds: [...state.focus.sessions.allIds, session.id],
                },
              },
              rewards: {
                ...state.rewards,
                balance: state.rewards.balance + fruitsToReAdd,
                totalEarned: state.rewards.totalEarned + fruitsToReAdd,
                updatedAt: new Date().toISOString(),
              },
            }));

            persistStateNow(get());
            enqueueSessionNow(get(), session);

            const newBalance = get().rewards.balance;
            const focusActive = get().focus.currentSession.isRunning;
            FamilyControlsModule.updateShieldBalance(newBalance, focusActive).catch((error) => {
              console.error('Failed to update shield balance after restoring session:', error);
            });

            get()
              .grove.recomputeChallengeHitsForTag(session.tagId)
              .catch(() => {});
            if (session.secondaryTagId && session.secondaryTagId !== session.tagId) {
              get()
                .grove.recomputeChallengeHitsForTag(session.secondaryTagId)
                .catch(() => {});
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
                  },
                },
              }));

              // Begin recording raw accelerometer for the session window so we can
              // suggest a focus rating at completion. Best-effort, fire-and-forget;
              // no-ops if motion APIs are unavailable. Gated on the user's explicit
              // opt-in — when off, the summary falls back to retroactive
              // CMMotionActivity/pedometer (no continuous recording).
              if (useUnifiedStore.getState().preferences.rawAccelRatingEnabled) {
                startSessionMotionRecording(session.duration * 60);
              }
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

                // Calculate and award fruits (duration curve, capped at the set duration)
                const completeMultiplier = get().rewards.isAccelerateActive() ? 2 : 1;
                const fruitsEarned = calculateFruitsEarnedForDuration(
                  actualDuration,
                  session.initialSetDuration ?? actualDuration,
                  completeMultiplier
                );

                // Store the accelerate multiplier + base/awarded fruits on the session
                // (so a focus rating can later scale the reward).
                get().focus.updateSession(id, {
                  accelerateMultiplier: completeMultiplier,
                  baseFruits: fruitsEarned,
                  awardedFruits: fruitsEarned,
                });

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
                      },
                    },
                  }));
                }
              }
            }
          },

          createCompletedSession: (params: {
            id?: string;
            startTime: Date;
            endTime: Date;
            duration: number;
            targetDuration: number;
            tagId: string;
            secondaryTagId?: string;
            notes?: string;
            isManualEntry?: boolean;
          }) => {
            console.log('📝 Creating completed session:', params);
            // Reuse a caller-supplied id when present (e.g. native widget/Live
            // Activity stop already pushed this session to Supabase under that id)
            // so the local row + its sync upsert merge with the native write
            // instead of creating a duplicate. Falls back to a fresh id otherwise.
            const sessionId = params.id || generateId();

            const createCompletedMultiplier = get().rewards.isAccelerateActive() ? 2 : 1;

            // Calculate and award fruits (duration curve, capped at the set duration).
            // Capture baseFruits/awardedFruits on the session so a focus rating can later scale it.
            const fruitsEarned = params.isManualEntry
              ? 0
              : calculateFruitsEarnedForDuration(
                  params.duration,
                  params.targetDuration,
                  createCompletedMultiplier
                );

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
              baseFruits: fruitsEarned,
              awardedFruits: fruitsEarned,
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
                },
              },
            }));

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
            get()
              .grove.recomputeChallengeHitsForTag(params.tagId)
              .catch(() => {});
            if (params.secondaryTagId && params.secondaryTagId !== params.tagId) {
              get()
                .grove.recomputeChallengeHitsForTag(params.secondaryTagId)
                .catch(() => {});
            }

            // Persist immediately, bypassing the debounced write. The summary screen
            // that renders right after this can do heavy synchronous work and freeze
            // the JS thread; the normal 100ms debounce timer would be stuck behind
            // that freeze, so a force-quit would lose this session. Dispatching the
            // native write synchronously here guarantees the session reaches disk
            // first. Notes/photos added later on the summary screen still flow through
            // the normal debounced persist + cloud sync paths.
            persistStateNow(get());

            // Push to the cloud queue immediately too — persistStateNow only saves
            // locally, and the debounced middleware upload (~2s later) can be beaten
            // by a force-quit, stranding the session local-only forever. See
            // enqueueSessionNow.
            enqueueSessionNow(get(), completedSession);

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

              if (existingById[id]) {
                skipped++;
                continue;
              }
              if (!(w.durationMinutes > 0)) {
                skipped++;
                continue;
              }

              // Hand-logged Health entries import like in-app manual entries: they
              // become sessions but never earn fruit, which keeps reward-bearing
              // imports un-farmable. Only genuine device-recorded workouts earn.
              // No accelerate multiplier: these are backfilled past workouts, so
              // current accelerate must not apply.
              if (!w.wasUserEntered) {
                fruitsEarned += calculateFruitsEarnedForDuration(
                  w.durationMinutes,
                  w.durationMinutes,
                  1
                );
              }

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
                // Mirrors deleteSession's deduction rule: manual entries granted 0
                // fruit, so deleting one deducts 0 — the grant stays symmetric.
                isManualEntry: w.wasUserEntered,
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

              // Award fruits for the device-recorded imports (hand-logged ones
              // contributed 0 above). Deletion deducts the same amount per
              // session's isManualEntry flag, so the grant stays symmetric.
              if (fruitsEarned > 0) {
                get().rewards.earnFruits(fruitsEarned, 'healthkit_import', { count: toAdd.length });
                console.log(
                  '🍎 Fruits earned:',
                  fruitsEarned,
                  'for',
                  toAdd.length,
                  'imported workouts'
                );
              }

              // Imported sessions can land in a challenge's tag/date range — keep
              // challenge hit counts correct, same as createCompletedSession.
              get()
                .grove.recomputeChallengeHitsForTag(tagId)
                .catch(() => {});
            }

            console.log(
              `[HealthKit] import: imported=${toAdd.length} skipped=${skipped} tagId=${tagId}`
            );
            return { imported: toAdd.length, skipped };
          },

          // View actions
          setSelectedDate: (date) => {
            console.log('📅 Setting selected date:', date);
            set((state) => ({
              focus: { ...state.focus, selectedDate: date },
            }));
          },

          setViewMode: (mode) => {
            console.log('👁️ Setting view mode:', mode);
            set((state) => ({
              focus: { ...state.focus, viewMode: mode },
            }));
          },

          goToPreviousWeek: () => {
            console.log('⬅️ Going to previous week');
            set((state) => {
              const newWeekStart = new Date(state.focus.currentWeekStart);
              newWeekStart.setDate(newWeekStart.getDate() - 7);
              return {
                focus: { ...state.focus, currentWeekStart: newWeekStart },
              };
            });
          },

          goToNextWeek: () => {
            console.log('➡️ Going to next week');
            set((state) => {
              const newWeekStart = new Date(state.focus.currentWeekStart);
              newWeekStart.setDate(newWeekStart.getDate() + 7);
              return {
                focus: { ...state.focus, currentWeekStart: newWeekStart },
              };
            });
          },

          goToCurrentWeek: () => {
            console.log('📍 Going to current week');
            set((state) => ({
              focus: { ...state.focus, currentWeekStart: getWeekStart() },
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
                },
              },
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
                        [goalId]: { ...existingGoal, ...updates, updatedAt: new Date() },
                      },
                    },
                  },
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
              // Activating a goal is the "set up goals" signal — unlock its setup-task claim.
              get().rewards.markTaskSetup('goal');
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
                  },
                },
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
              restDays
            );

            set((state) => {
              const existingGoal = state.focus.goals.byId[goalId];
              if (!existingGoal) return state;
              const badges = state.focus.badges || {
                byId: {},
                allIds: [],
                loading: false,
                error: null,
                lastUpdated: null,
              };

              const existingBadge = Object.values(badges.byId).find(
                (b: any) => b.goalId === goalId
              ) as any;
              const badgeId = existingBadge
                ? existingBadge.id
                : `badge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
                },
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
                  },
                },
              };
            });
          },

          // --- TODOs ---
          createTodo: (input) => {
            const todoId = generateId();
            const now = new Date();
            const todo: Todo = {
              id: todoId,
              userId: get().auth?.user?.id ?? 'local-user',
              name: input.name.trim(),
              tagId: input.tagId,
              startAt: input.startAt,
              startHasTime: input.startHasTime,
              deadlineAt: input.deadlineAt,
              deadlineHasTime: input.deadlineHasTime,
              durationMinutes: input.durationMinutes,
              notes: input.notes?.trim() || undefined,
              recurrence: input.recurrence,
              completed: false,
              // sortOrder is the single ordering key. Default it from start time so
              // the list reads chronologically out of the box: timed todos sort by
              // their start (minutes since epoch), untimed ones fall after all timed
              // (large base) in creation order. Drag-to-reorder overwrites these.
              sortOrder: input.startAt
                ? Math.floor(new Date(input.startAt).getTime() / 60000)
                : TODO_UNTIMED_SORT_BASE + get().focus.todos.allIds.length,
              createdAt: now,
              updatedAt: now,
            };
            set((state) => ({
              focus: {
                ...state.focus,
                todos: {
                  ...state.focus.todos,
                  byId: { ...state.focus.todos.byId, [todoId]: todo },
                  allIds: [...state.focus.todos.allIds, todoId],
                  lastUpdated: now,
                },
              },
            }));
            syncTodosWidget();
            return todo;
          },

          updateTodo: (todoId, updates) => {
            set((state) => {
              const existing = state.focus.todos.byId[todoId];
              if (!existing) return state;
              return {
                focus: {
                  ...state.focus,
                  todos: {
                    ...state.focus.todos,
                    byId: {
                      ...state.focus.todos.byId,
                      [todoId]: { ...existing, ...updates, updatedAt: new Date() },
                    },
                    lastUpdated: new Date(),
                  },
                },
              };
            });
            syncTodosWidget();
          },

          rollRecurringTodos: () => {
            const now = new Date();
            const today = startOfDay(now);
            let rolled = false;
            set((state) => {
              const { todos } = state.focus;
              const byId = { ...todos.byId };
              const allIds = [...todos.allIds];
              for (const id of todos.allIds) {
                const todo = byId[id];
                if (!todo?.recurrence || !todo.startAt || todo.deletedAt) continue;
                const start = new Date(todo.startAt);
                if (startOfDay(start).getTime() >= today.getTime()) continue;
                rolled = true;
                if (todo.completed) {
                  // Preserve history: the finished occurrence stays behind as a
                  // plain (non-recurring) completed todo.
                  const copyId = generateId();
                  const snapshot: Todo = { ...todo, id: copyId, createdAt: now, updatedAt: now };
                  delete snapshot.recurrence;
                  byId[copyId] = snapshot;
                  allIds.push(copyId);
                }
                const nextStart = nextOccurrence(todo.recurrence, start, today);
                const dayDelta = startOfDay(nextStart).getTime() - startOfDay(start).getTime();
                byId[id] = {
                  ...todo,
                  startAt: nextStart,
                  deadlineAt: todo.deadlineAt
                    ? new Date(new Date(todo.deadlineAt).getTime() + dayDelta)
                    : undefined,
                  completed: false,
                  completedAt: undefined,
                  // Same chronological default as createTodo, so the rolled todo
                  // sorts into its new day instead of by its old start.
                  sortOrder: Math.floor(nextStart.getTime() / 60000),
                  updatedAt: now,
                };
              }
              if (!rolled) return state;
              return {
                focus: {
                  ...state.focus,
                  todos: { ...todos, byId, allIds, lastUpdated: now },
                },
              };
            });
            if (rolled) syncTodosWidget();
          },

          toggleTodo: (todoId) => {
            set((state) => {
              const existing = state.focus.todos.byId[todoId];
              if (!existing) return state;
              const completed = !existing.completed;
              return {
                focus: {
                  ...state.focus,
                  todos: {
                    ...state.focus.todos,
                    byId: {
                      ...state.focus.todos.byId,
                      [todoId]: {
                        ...existing,
                        completed,
                        completedAt: completed ? new Date() : undefined,
                        updatedAt: new Date(),
                      },
                    },
                    lastUpdated: new Date(),
                  },
                },
              };
            });
            syncTodosWidget();
          },

          setTodoCompleted: (todoId, completed) => {
            set((state) => {
              const existing = state.focus.todos.byId[todoId];
              if (!existing || existing.completed === completed) return state;
              return {
                focus: {
                  ...state.focus,
                  todos: {
                    ...state.focus.todos,
                    byId: {
                      ...state.focus.todos.byId,
                      [todoId]: {
                        ...existing,
                        completed,
                        completedAt: completed ? new Date() : undefined,
                        updatedAt: new Date(),
                      },
                    },
                    lastUpdated: new Date(),
                  },
                },
              };
            });
            syncTodosWidget();
          },

          deleteTodo: (todoId) => {
            // Soft-delete so the cloud row is tombstoned (mirrors tags).
            set((state) => {
              const existing = state.focus.todos.byId[todoId];
              if (!existing) return state;
              return {
                focus: {
                  ...state.focus,
                  todos: {
                    ...state.focus.todos,
                    byId: {
                      ...state.focus.todos.byId,
                      [todoId]: { ...existing, deletedAt: new Date(), updatedAt: new Date() },
                    },
                    lastUpdated: new Date(),
                  },
                },
              };
            });
            syncTodosWidget();
          },

          restoreTodo: (todoId) => {
            set((state) => {
              const existing = state.focus.todos.byId[todoId];
              if (!existing) return state;
              const { deletedAt, ...rest } = existing;
              return {
                focus: {
                  ...state.focus,
                  todos: {
                    ...state.focus.todos,
                    byId: {
                      ...state.focus.todos.byId,
                      [todoId]: { ...rest, updatedAt: new Date() },
                    },
                    lastUpdated: new Date(),
                  },
                },
              };
            });
            syncTodosWidget();
          },

          reorderTodos: (orderedIds) => {
            // Re-encode the new manual order into sortOrder for just this subset.
            // Anchor at the subset's current minimum so the reordered todos keep
            // their rough global position (timed vs untimed magnitude) instead of
            // jumping to the front of the cross-tag list — they only change order
            // relative to each other. Other todos are left untouched.
            set((state) => {
              const byId = state.focus.todos.byId;
              const existingOrders = orderedIds
                .map((id) => byId[id]?.sortOrder)
                .filter((n): n is number => typeof n === 'number');
              const base = existingOrders.length ? Math.min(...existingOrders) : 0;
              const now = new Date();
              const updatedById = { ...byId };
              orderedIds.forEach((id, index) => {
                if (updatedById[id]) {
                  updatedById[id] = {
                    ...updatedById[id],
                    sortOrder: base + index,
                    updatedAt: now,
                  };
                }
              });
              return {
                focus: {
                  ...state.focus,
                  todos: {
                    ...state.focus.todos,
                    byId: updatedById,
                    lastUpdated: now,
                  },
                },
              };
            });
            syncTodosWidget();
          },

          // --- AI Focus Coach ---
          upsertCoachReport: (report) => {
            set((state) => {
              const reports = state.focus.coachReports || {
                byId: {},
                allIds: [],
                loading: false,
                error: null,
                lastUpdated: null,
              };
              const exists = !!reports.byId[report.id];
              return {
                focus: {
                  ...state.focus,
                  coachReports: {
                    ...reports,
                    byId: { ...reports.byId, [report.id]: report },
                    allIds: exists ? reports.allIds : [...reports.allIds, report.id],
                    lastUpdated: new Date(),
                  },
                },
              };
            });
          },

          deleteCoachReport: (reportId) => {
            set((state) => {
              const reports = state.focus.coachReports || { byId: {}, allIds: [] };
              const { [reportId]: removed, ...remaining } = reports.byId;
              return {
                focus: {
                  ...state.focus,
                  coachReports: {
                    ...reports,
                    byId: remaining,
                    allIds: reports.allIds.filter((id: string) => id !== reportId),
                    lastUpdated: new Date(),
                  },
                },
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
              focus: { ...state.focus, lastSelectedTagId: tagId },
            }));
          },
          lastDurationByTagId: {} as Record<string, number>,
          setLastDurationForTag: (tagId: string, duration: number) => {
            set((state) => ({
              focus: {
                ...state.focus,
                lastDurationByTagId: { ...state.focus.lastDurationByTagId, [tagId]: duration },
              },
            }));
            persistStateNow(get());
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
              totalTargetMinutes: 0,
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
                },
              },
            }));
            return tag;
          },

          updateTag: (tagId, updates) => {
            console.log('🏷️ Updating tag:', tagId, updates);
            set((state) => {
              const existingTag = state.focus.tags.byId[tagId];
              if (existingTag) {
                const updatedTag = { ...existingTag, ...updates, id: tagId, updatedAt: new Date() }; // id is immutable
                return {
                  focus: {
                    ...state.focus,
                    tags: {
                      ...state.focus.tags,
                      byId: {
                        ...state.focus.tags.byId,
                        [tagId]: updatedTag,
                      },
                    },
                  },
                };
              }
              return state;
            });
          },

          deleteTag: (tagId) => {
            console.log('🗑️ Soft-deleting tag:', tagId);
            const tag = get().focus.tags.byId[tagId];

            if (tag) {
              set((state) => {
                // Remove last duration entry for this tag
                const { [tagId]: _removedDuration, ...remainingDurations } =
                  state.focus.lastDurationByTagId;

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
                  },
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
                modals: { ...state.ui.modals, [type]: data || {} },
              },
            }));
          },
          hideModal: (type: string) => {
            set((state) => {
              const { [type]: removed, ...remainingModals } = state.ui.modals;
              return {
                ui: { ...state.ui, modals: remainingModals },
              };
            });
          },
          setLoading: (action: string, loading: boolean) => {
            set((state) => ({
              ui: {
                ...state.ui,
                loading: {
                  ...state.ui.loading,
                  actions: { ...state.ui.loading.actions, [action]: loading },
                },
              },
            }));
          },
          addError: (error: any) => {
            set((state) => ({
              ui: { ...state.ui, errors: [...state.ui.errors, error] },
            }));
          },
          clearError: (errorId: string) => {
            set((state) => ({
              ui: {
                ...state.ui,
                errors: state.ui.errors.filter((_, index) => index.toString() !== errorId),
              },
            }));
          },
          clearAllErrors: () => {
            set((state) => ({
              ui: { ...state.ui, errors: [] },
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
              settings: { ...state.settings, theme },
            }));
          },
          updateLanguage: (language) => {
            set((state) => ({
              settings: { ...state.settings, language },
            }));
          },
          updateNotifications: (notifications) => {
            set((state) => ({
              settings: { ...state.settings, notifications },
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
          unlockHistory: {},
          tasks: defaultSetupTasks(),
          purchases: { byId: {}, allIds: [] },
          customRewards: { byId: {}, allIds: [] },
          earnFruits: (amount, source, metadata) => {
            set((state) => ({
              rewards: {
                ...state.rewards,
                balance: state.rewards.balance + amount,
                totalEarned: state.rewards.totalEarned + amount,
                updatedAt: new Date().toISOString(),
              },
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
              },
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
            const app = get().rewards.unlockableApps.find((app) => app.id === appId);
            if (app) {
              set((state) => ({
                rewards: {
                  ...state.rewards,
                  // Balance can never drop below 0.
                  balance: Math.max(0, state.rewards.balance - app.price),
                  totalSpent: state.rewards.totalSpent + app.price,
                  updatedAt: new Date().toISOString(),
                  unlockableApps: state.rewards.unlockableApps.filter((a) => a.id !== appId),
                },
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
            get().rewards.addPurchase('accelerate_card', cost);
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
          purchaseTip: () => {
            const cost = 5;
            const balance = get().rewards.balance;
            if (balance < cost) {
              throw new Error(`Insufficient fruits. Required: ${cost}, Available: ${balance}`);
            }
            const purchases = get().rewards.purchases ?? { byId: {}, allIds: [] };
            const purchasedTipIds = purchases.allIds
              .map((id) => purchases.byId[id]?.tipId)
              .filter((tipId): tipId is string => !!tipId);
            const tipId = pickTipId(purchasedTipIds);
            // Backstop — the store UI disables the product when the catalog is
            // exhausted, so this only fires if a caller skips that check.
            if (!tipId) {
              throw new Error('All tips already purchased');
            }
            get().rewards.spendFruits(cost, 'product_tip', { product: 'usage_tip', tipId });
            get().rewards.addPurchase('usage_tip', cost, { tipId });
            return tipId;
          },
          purchaseTheme: (themeId) => {
            // Dev accounts pay 1 apple (test price); everyone else SLIDER_THEME_COST.
            const cost = sliderThemeCostForUser(get().auth.user?.id);
            const balance = get().rewards.balance;
            if (balance < cost) {
              throw new Error(`Insufficient fruits. Required: ${cost}, Available: ${balance}`);
            }
            const productId = themeProductId(themeId);
            const purchases = get().rewards.purchases ?? { byId: {}, allIds: [] };
            // Backstop — the store UI shows owned themes as applyable, not buyable.
            const owned = purchases.allIds.some(
              (id) => purchases.byId[id]?.productId === productId
            );
            if (owned) {
              throw new Error(`Theme already owned: ${themeId}`);
            }
            get().rewards.spendFruits(cost, 'slider_theme', { themeId });
            get().rewards.addPurchase(productId, cost);
          },
          addPurchase: (productId, cost, metadata) => {
            const now = new Date().toISOString();
            const purchase: Purchase = {
              id: generateId(),
              productId,
              cost,
              ...(metadata?.tipId ? { tipId: metadata.tipId } : {}),
              createdAt: now,
              updatedAt: now,
            };
            set((state) => {
              const purchases = state.rewards.purchases ?? { byId: {}, allIds: [] };
              return {
                rewards: {
                  ...state.rewards,
                  purchases: {
                    byId: { ...purchases.byId, [purchase.id]: purchase },
                    allIds: [...purchases.allIds, purchase.id],
                  },
                },
              };
            });
          },
          addCustomReward: (name, cost, emoji) => {
            const now = new Date().toISOString();
            const reward: CustomReward = {
              id: generateId(),
              name: name.trim(),
              ...(emoji ? { emoji } : {}),
              cost: Math.max(1, Math.round(cost)),
              createdAt: now,
              updatedAt: now,
            };
            set((state) => {
              const customRewards = state.rewards.customRewards ?? { byId: {}, allIds: [] };
              return {
                rewards: {
                  ...state.rewards,
                  customRewards: {
                    byId: { ...customRewards.byId, [reward.id]: reward },
                    allIds: [...customRewards.allIds, reward.id],
                  },
                },
              };
            });
            return reward.id;
          },
          deleteCustomReward: (rewardId) => {
            set((state) => {
              const customRewards = state.rewards.customRewards ?? { byId: {}, allIds: [] };
              if (!customRewards.byId[rewardId]) return state;
              const { [rewardId]: _removed, ...byId } = customRewards.byId;
              return {
                rewards: {
                  ...state.rewards,
                  customRewards: {
                    byId,
                    allIds: customRewards.allIds.filter((id) => id !== rewardId),
                  },
                },
              };
            });
          },
          purchaseCustomReward: (rewardId) => {
            const reward = get().rewards.customRewards?.byId[rewardId];
            // Backstop — the store UI only offers rewards that exist in the catalog.
            if (!reward) {
              throw new Error(`Custom reward not found: ${rewardId}`);
            }
            const balance = get().rewards.balance;
            if (balance < reward.cost) {
              throw new Error(
                `Insufficient fruits. Required: ${reward.cost}, Available: ${balance}`
              );
            }
            const productId = customRewardProductId(rewardId);
            const purchases = get().rewards.purchases ?? { byId: {}, allIds: [] };
            // Backstop — bought rewards are filtered out of the catalog.
            const owned = purchases.allIds.some(
              (id) => purchases.byId[id]?.productId === productId
            );
            if (owned) {
              throw new Error(`Custom reward already bought: ${rewardId}`);
            }
            get().rewards.spendFruits(reward.cost, 'custom_reward', { rewardId });
            get().rewards.addPurchase(productId, reward.cost);
          },
          setPurchasePhoto: (purchaseId, photoUrl) => {
            set((state) => {
              const purchases = state.rewards.purchases ?? { byId: {}, allIds: [] };
              const purchase = purchases.byId[purchaseId];
              if (!purchase) return state;
              return {
                rewards: {
                  ...state.rewards,
                  purchases: {
                    ...purchases,
                    byId: {
                      ...purchases.byId,
                      [purchaseId]: {
                        ...purchase,
                        photoUrl,
                        updatedAt: new Date().toISOString(),
                      },
                    },
                  },
                },
              };
            });
          },
          isAccelerateActive: () => {
            const card = get().rewards.accelerateCard;
            if (!card) return false;
            return new Date(card.expiresAt) > new Date();
          },

          markTaskSetup: (taskId) => {
            const task = get().rewards.tasks?.[taskId];
            if (task?.everSetup) return; // already sticky-set, nothing to do
            set((state) => ({
              rewards: {
                ...state.rewards,
                // Note: intentionally NOT bumping updatedAt. updatedAt governs the
                // last-write-wins of the balance aggregate; bumping it here (e.g. widget
                // detection racing a cold-start merge on a fresh reinstall) could let a
                // stale local balance:0 win and wipe the user's fruits. everSetup is
                // monotonic and OR-merged in sync, so it rides the next real rewards push.
                tasks: {
                  ...normalizeSetupTasks(state.rewards.tasks),
                  [taskId]: {
                    ...normalizeSetupTasks(state.rewards.tasks)[taskId],
                    everSetup: true,
                  },
                },
              },
            }));
            console.log('🎁 Setup task available to claim:', taskId);
          },

          reconcileSetupTasks: () => {
            // Goal task: existing users with any active goal have "set up goals".
            const hasActiveGoal = get().focus.goals.allIds.some(
              (id: string) => get().focus.goals.byId[id]?.isActive === true
            );
            if (hasActiveGoal) get().rewards.markTaskSetup('goal');
          },

          claimTask: (taskId) => {
            const task = normalizeSetupTasks(get().rewards.tasks)[taskId];
            if (!task.everSetup || task.claimed) return false;
            // Mark claimed first so the rewards row pushed by earnFruits already carries it.
            set((state) => ({
              rewards: {
                ...state.rewards,
                tasks: {
                  ...normalizeSetupTasks(state.rewards.tasks),
                  [taskId]: { everSetup: true, claimed: true },
                },
              },
            }));
            // earnFruits bumps balance + updatedAt and triggers the rewards sync push, so
            // both the +fruits and the claimed flag reach the cloud together.
            get().rewards.earnFruits(SETUP_TASK_REWARD, 'setup_task', { taskId });
            console.log('🎁 Setup task claimed:', taskId, '+', SETUP_TASK_REWARD, 'fruits');
            return true;
          },
        },

        // Blocklist state
        blocklist: {
          settings: {
            blockedApps: {
              applicationTokens: [],
              categoryTokens: [],
              webDomainTokens: [],
            },
            unlockCostPerMinute: 1, // 1 fruit per minute
            scheduleEnabled: false,
          },
          currentSelectionId: null,
          activeSessions: {
            byId: {},
            allIds: [],
          },
          transactions: {
            byId: {},
            allIds: [],
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
                  lastAuthCheck: new Date(),
                },
              }));

              console.log(
                '🔍 Current authorization status:',
                status,
                'isAuthorized:',
                isAuthorized
              );
              return isAuthorized;
            } catch (error) {
              console.error('❌ Failed to check authorization status:', error);
              set((state) => ({
                blocklist: {
                  ...state.blocklist,
                  isAuthorized: false,
                  authorizationStatus: 3, // 3 = unknown/error
                  lastAuthCheck: new Date(),
                },
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
                  lastAuthCheck: new Date(),
                },
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
                  lastAuthCheck: new Date(),
                },
              }));
              return false;
            }
          },

          updateBlockedApps: async (
            selection: FamilyActivitySelection,
            metadata?: {
              applicationCount?: number;
              categoryCount?: number;
              webDomainCount?: number;
            },
            chargeFruit?: boolean
          ) => {
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
                  throw new Error(
                    `Insufficient fruits. Need ${editCost} but have ${currentBalance}.`
                  );
                }

                // Deduct cost
                get().rewards.spendFruits(editCost, 'blocklist_edit', { editCost });

                // Update edit history
                const currentWeekStart = getWeekStart().toISOString();
                const { editHistory } = get().blocklist;
                const editsThisWeek =
                  editHistory.weekStart === currentWeekStart ? editHistory.editsThisWeek + 1 : 1; // new week, this is the first edit

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
                          webDomainTokens: [],
                        },
                      },
                    },
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
                  applicationTokens: metadata?.applicationCount
                    ? [
                        {
                          id: selection,
                          bundleIdentifier: 'selected.apps',
                          displayName: `${metadata.applicationCount} Selected Apps`,
                        },
                      ]
                    : [],
                  categoryTokens: metadata?.categoryCount
                    ? [
                        {
                          id: selection,
                          bundleIdentifier: 'selected.categories',
                          displayName: `${metadata.categoryCount} Selected Categories`,
                        },
                      ]
                    : [],
                  webDomainTokens: metadata?.webDomainCount
                    ? [
                        {
                          id: selection,
                          bundleIdentifier: 'selected.domains',
                          displayName: `${metadata.webDomainCount} Selected Domains`,
                        },
                      ]
                    : [],
                };

                console.log('📱 Store: Generated legacySelection:', legacySelection);
                console.log('📱 Store: Updating store state...');

                set((state) => {
                  console.log(
                    '📱 Store: Current state before update:',
                    state.blocklist.settings.blockedApps
                  );
                  const newState = {
                    blocklist: {
                      ...state.blocklist,
                      currentSelectionId: selection,
                      settings: {
                        ...state.blocklist.settings,
                        blockedApps: legacySelection,
                      },
                    },
                  };
                  console.log(
                    '📱 Store: New state after update:',
                    newState.blocklist.settings.blockedApps
                  );
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
                  ...settingsUpdate,
                },
              },
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
                remainingTime: duration * 60,
              };

              // Create unlock transaction
              const transaction: UnlockTransaction = {
                id: generateId(),
                sessionId,
                appTokens,
                duration,
                cost: totalCost,
                timestamp: new Date(),
                status: 'completed',
              };

              // Record today's unlocked minutes for the trend chart, pruning to
              // the most recent 30 days so the history can't grow unbounded. Stored on
              // the rewards slice so it rides the rewards row's cloud sync (survives
              // reinstalls). The spendFruits call below bumps rewards.updatedAt, which
              // is what enqueues this row for sync.
              const todayKey = startTime.toLocaleDateString('en-CA'); // YYYY-MM-DD (local)
              const prunedHistory: Record<string, number> = {};
              const cutoff = new Date(startTime);
              cutoff.setDate(cutoff.getDate() - 30);
              const cutoffKey = cutoff.toLocaleDateString('en-CA');
              Object.entries(rewards.unlockHistory ?? {}).forEach(([key, mins]) => {
                if (key >= cutoffKey) prunedHistory[key] = mins;
              });
              prunedHistory[todayKey] = (prunedHistory[todayKey] ?? 0) + duration;

              // Update state
              set((state) => ({
                rewards: {
                  ...state.rewards,
                  unlockHistory: prunedHistory,
                },
                blocklist: {
                  ...state.blocklist,
                  lastUnlockDuration: duration,
                  activeSessions: {
                    byId: { ...state.blocklist.activeSessions.byId, [sessionId]: unlockSession },
                    allIds: [...state.blocklist.activeSessions.allIds, sessionId],
                  },
                  transactions: {
                    byId: { ...state.blocklist.transactions.byId, [transaction.id]: transaction },
                    allIds: [...state.blocklist.transactions.allIds, transaction.id],
                  },
                },
              }));

              // Spend fruits
              get().rewards.spendFruits(totalCost, 'app_unlock', {
                sessionId,
                duration,
                appTokens,
              });

              // Note: Actual unlocking is now handled by UnlockSnackbar using unblockSelection
              // This function just tracks the unlock session for accounting purposes

              console.log('✅ Unlock session created:', unlockSession);
              return unlockSession;
            } catch (error) {
              console.error('❌ Failed to create unlock session:', error);
              return null;
            }
          },

          endUnlock: (
            sessionId: string,
            reason: 'expired' | 'manual' = 'expired',
            endedAtMs?: number
          ) => {
            console.log('🔒 Ending unlock session:', sessionId);
            const session = get().blocklist.activeSessions.byId[sessionId];

            if (session && session.isActive) {
              // Refund the unused minutes based on when the unlock ACTUALLY ended.
              // endedAtMs is the real end moment: Date.now() for an in-app end, or
              // the native stop marker's timestamp for a Live Activity end. It
              // defaults to the session's own endTime, so a natural expiry (or any
              // caller that omits it) refunds nothing. Computing this here — the
              // single end funnel — guarantees no path (including the 'expired'
              // auto-expire) can end a session without the correct refund.
              const endTimeMs =
                session.endTime instanceof Date
                  ? session.endTime.getTime()
                  : new Date(session.endTime).getTime();
              const effectiveEndMs = Math.min(endedAtMs ?? endTimeMs, endTimeMs);
              const remainingMinutes = Math.floor(
                Math.max(0, endTimeMs - effectiveEndMs) / (60 * 1000)
              );
              const refundAmount = Math.min(
                session.cost,
                remainingMinutes * get().blocklist.settings.unlockCostPerMinute
              );

              // Stop Live Activity if it exists
              if (session.liveActivityId) {
                console.log('🛑 Stopping Live Activity for session:', sessionId);
                LiveActivityService.stopUnlockCountdown(session.liveActivityId, reason);
              }

              if (session.notificationId) {
                Notifications.cancelScheduledNotificationAsync(session.notificationId).catch(
                  (error) => {
                    console.error('Failed to cancel unlock expiration notification:', error);
                  }
                );
              }

              // Clear the shared UserDefaults copy too (native StopUnlockIntent may
              // have already cancelled it). Keeps the key from leaking a stale ID
              // into a later session. Mirrors the focus-session stop path.
              WidgetService.syncScheduledNotificationId(null);

              // Subtract the unused minutes from the trend chart bucket for the day
              // this unlock was purchased (keyed by startTime, matching requestUnlock),
              // so the chart reflects minutes actually used, not just purchased.
              const startTimeMs =
                session.startTime instanceof Date ? session.startTime : new Date(session.startTime);
              const dayKey = startTimeMs.toLocaleDateString('en-CA');
              const currentHistory = get().rewards.unlockHistory ?? {};
              const adjustedHistory = { ...currentHistory };
              if (remainingMinutes > 0 && adjustedHistory[dayKey] !== undefined) {
                adjustedHistory[dayKey] = Math.max(0, adjustedHistory[dayKey] - remainingMinutes);
              }

              set((state) => ({
                rewards: {
                  ...state.rewards,
                  unlockHistory: adjustedHistory,
                },
                blocklist: {
                  ...state.blocklist,
                  activeSessions: {
                    ...state.blocklist.activeSessions,
                    byId: {
                      ...state.blocklist.activeSessions.byId,
                      [sessionId]: {
                        ...session,
                        isActive: false,
                        remainingTime: 0,
                        notificationId: undefined,
                      },
                    },
                  },
                },
              }));

              // Refund unused minutes AFTER writing unlockHistory above, so earnFruits
              // (which bumps rewards.updatedAt and is the mutation the sync middleware
              // keys off) captures the already-adjusted history in its state snapshot.
              // Order matters: if we refunded first, the middleware would push the
              // stale pre-refund history until the next rewards change.
              if (refundAmount > 0) {
                get().rewards.earnFruits(refundAmount, 'unlock_refund', {
                  sessionId,
                  refundedMinutes: remainingMinutes,
                });
                console.log(
                  `🍎 Refunded ${refundAmount} fruits for ${remainingMinutes} unused unlock minute(s)`
                );
              }

              // Note: Re-blocking is now handled automatically by DeviceActivity schedule

              // Show idle focus Live Activity so user can start a new session from
              // the lock screen. The unlock LA was just dismissed above, so this
              // must CREATE a fresh idle activity (ensureIdleFocusActivity), not
              // merely update — updateAllActivities would find nothing to update.
              const focus = get().focus;
              const tagId = focus.lastSelectedTagId;
              const tag = tagId ? focus.tags.byId[tagId] : undefined;
              const tagLabel = tag ? `${tag.icon || '🎯'} ${tag.name}` : 'Focus';
              const lastDuration = tagId ? focus.lastDurationByTagId[tagId] : undefined;
              LiveActivityService.ensureIdleFocusActivity(
                tagLabel,
                tagId || undefined,
                lastDuration
              );

              console.log('🔒 Unlock session ended:', sessionId);
            }
          },

          checkActiveUnlocks: () => {
            const now = new Date();
            const { activeSessions } = get().blocklist;

            // If the unlock was ended natively from the Live Activity while the app
            // was backgrounded, StopUnlockIntent wrote a stop marker carrying the
            // real end time. Honor it here so the unused-time refund is based on
            // when the user actually ended the unlock — NOT on this (possibly much
            // later) app open. Without this, reopening the app after the unlock
            // window elapsed force-expires the session with zero refund before the
            // marker can be processed. Read-and-clears the marker.
            const stopMarker = WidgetService.checkWidgetUnlockStopAction();

            Object.values(activeSessions.byId).forEach((session) => {
              if (!session.isActive) return;
              if (stopMarker) {
                console.log('🔓 Ending unlock from native stop marker:', session.id);
                get().blocklist.endUnlock(session.id, 'manual', stopMarker.timestamp);
              } else if (now >= session.endTime) {
                console.log('⏰ Auto-ending expired unlock session:', session.id);
                get().blocklist.endUnlock(session.id, 'expired');
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
        },
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
export const useTodos = () => useAppStore((state) => state.focus.todos);
export const useTodoActions = () =>
  useAppStore((state) => ({
    createTodo: state.focus.createTodo,
    updateTodo: state.focus.updateTodo,
    toggleTodo: state.focus.toggleTodo,
    setTodoCompleted: state.focus.setTodoCompleted,
    deleteTodo: state.focus.deleteTodo,
    restoreTodo: state.focus.restoreTodo,
    reorderTodos: state.focus.reorderTodos,
  }));
export const useSettings = () => useAppStore((state) => state.settings);
export const useUI = () => useAppStore((state) => state.ui);
export const useRewards = () => useAppStore((state) => state.rewards);
export const useBlocklist = () => useAppStore((state) => state.blocklist);
export const useGrove = () => useAppStore((state) => state.grove);
export const useGroveActions = () =>
  useAppStore((state) => ({
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
export const useFocusActions = () =>
  useAppStore(
    useShallow((state) => ({
      createSession: state.focus.createSession,
      updateSession: state.focus.updateSession,
      adjustSessionDuration: state.focus.adjustSessionDuration,
      applyFocusRating: state.focus.applyFocusRating,
      autoRateSessionFromMotion: state.focus.autoRateSessionFromMotion,
      deleteSession: state.focus.deleteSession,
      restoreSession: state.focus.restoreSession,
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
      upsertCoachReport: state.focus.upsertCoachReport,
      deleteCoachReport: state.focus.deleteCoachReport,
      reorderGoals: state.focus.reorderGoals,
      getActiveGoals: state.focus.getActiveGoals,
      createTodo: state.focus.createTodo,
      updateTodo: state.focus.updateTodo,
      toggleTodo: state.focus.toggleTodo,
      deleteTodo: state.focus.deleteTodo,
      restoreTodo: state.focus.restoreTodo,
      reorderTodos: state.focus.reorderTodos,
    }))
  );

export const useUIActions = () =>
  useAppStore(
    useShallow((state) => ({
      showModal: state.ui.showModal,
      hideModal: state.ui.hideModal,
      setLoading: state.ui.setLoading,
      addError: state.ui.addError,
      clearError: state.ui.clearError,
      clearAllErrors: state.ui.clearAllErrors,
    }))
  );

export const useSettingsActions = () =>
  useAppStore(
    useShallow((state) => ({
      updateTheme: state.settings.updateTheme,
      updateLanguage: state.settings.updateLanguage,
      updateNotifications: state.settings.updateNotifications,
    }))
  );

export const useRewardsActions = () =>
  useAppStore(
    useShallow((state) => ({
      earnFruits: state.rewards.earnFruits,
      spendFruits: state.rewards.spendFruits,
      unlockApp: state.rewards.unlockApp,
    }))
  );

export const useBlocklistActions = () =>
  useAppStore(
    useShallow((state) => ({
      checkAuthorizationStatus: state.blocklist.checkAuthorizationStatus,
      requestAuthorization: state.blocklist.requestAuthorization,
      updateBlockedApps: state.blocklist.updateBlockedApps,
      updateSettings: state.blocklist.updateSettings,
      requestUnlock: state.blocklist.requestUnlock,
      endUnlock: state.blocklist.endUnlock,
      checkActiveUnlocks: state.blocklist.checkActiveUnlocks,
      getBlocklistEditCost: state.blocklist.getBlocklistEditCost,
    }))
  );

export const useBlocklistEditCost = () =>
  useAppStore(
    useShallow((state) => {
      const { editHistory } = state.blocklist;
      const currentWeekStart = getWeekStart().toISOString();
      const editsThisWeek =
        editHistory.weekStart === currentWeekStart ? editHistory.editsThisWeek : 0;
      const cost = Math.pow(2, editsThisWeek); // 1, 2, 4, 8, 16...
      return {
        cost,
        editsThisWeek,
        canAfford: state.rewards.balance >= cost,
        balance: state.rewards.balance,
      };
    })
  );

/**
 * Store selectors hooks
 */
export const useFocusSelectors = () =>
  useAppStore((state) => ({
    getSessionById: (id: string) => state.focus.sessions.byId[id],
    getSessionsForDate: (date: Date) => {
      const sessions = Object.values(state.focus.sessions.byId);
      return sessions.filter((session) => {
        const sessionDate = new Date(session.startTime);
        return sessionDate.toDateString() === date.toDateString();
      });
    },
    getSessionsForDateRange: (startDate: Date, endDate: Date) => {
      const sessions = Object.values(state.focus.sessions.byId);
      return sessions.filter((session) => {
        const sessionDate = new Date(session.startTime);
        return sessionDate >= startDate && sessionDate <= endDate;
      });
    },
    getActiveSession: () => state.focus.currentSession.session,
    getTagById: (id: string) => state.focus.tags.byId[id],
    getAllTags: () => Object.values(state.focus.tags.byId),
    getCompletedSessions: () => Object.values(state.focus.sessions.byId).filter(Boolean),
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
      Work: CLASSIC_TAG_COLORS.blue,
      Study: CLASSIC_TAG_COLORS.amber,
      Reading: CLASSIC_TAG_COLORS.orange,
      Exercise: CLASSIC_TAG_COLORS.green,
      Creative: CLASSIC_TAG_COLORS.purple,
      Personal: CLASSIC_TAG_COLORS.skyBlue,
    };
    const currentState = getStoreState();
    for (const tagId of currentState.focus.tags.allIds) {
      const tag = currentState.focus.tags.byId[tagId];
      if (tag && !tag.color) {
        currentState.focus.updateTag(tagId, {
          color: defaultColorMap[tag.name] || DEFAULT_TAG_COLOR,
        });
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
        totalTargetMinutes: 0,
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
      todos: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      badges: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      coachReports: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: null },
      currentSession: { session: null, isRunning: false, remainingTime: 0, startedAt: null },
      lastSelectedTagId: null,
      lastDurationByTagId: {},
    },
    rewards: {
      ...s.rewards,
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      updatedAt: null,
      unlockableApps: [],
      accelerateCard: null,
      unlockHistory: {},
      tasks: defaultSetupTasks(),
      purchases: { byId: {}, allIds: [] },
      customRewards: { byId: {}, allIds: [] },
    },
    blocklist: {
      ...s.blocklist,
      settings: {
        blockedApps: {
          applicationTokens: [],
          categoryTokens: [],
          webDomainTokens: [],
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
    ...(keepAuth
      ? {}
      : {
          auth: {
            ...s.auth,
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
            lastSignedInUserId: null,
          },
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
      gifts: [],
      giftsLoading: false,
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
    },
  });
};
