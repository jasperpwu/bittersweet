import { SyncService } from '../../services/sync/SyncService';
import {
  settingsToRow,
  sessionToRow,
  tagToRow,
  goalToRow,
  todoToRow,
  badgeToRow,
  coachReportToRow,
  mergeSetupTasks,
} from '../../services/sync/SyncMapper';
import { supabase } from '../../config/supabase';
import { syncQueue } from '../../services/sync/SyncQueue';
import { invalidateSyncSnapshot } from '../middleware/syncMiddleware';
import { BlocklistSyncService } from '../../services/sync/BlocklistSyncService';
import { FamilyControlsModule } from '../../modules/BitterSweetFamilyControls';
import { WidgetService } from '../../services/WidgetService';

function buildLegacySelection(
  selectionId: string,
  counts: { applicationCount: number; categoryCount: number; webDomainCount: number }
) {
  return {
    applicationTokens: counts.applicationCount
      ? [{ id: selectionId, bundleIdentifier: 'selected.apps', displayName: `${counts.applicationCount} Selected Apps` }]
      : [],
    categoryTokens: counts.categoryCount
      ? [{ id: selectionId, bundleIdentifier: 'selected.categories', displayName: `${counts.categoryCount} Selected Categories` }]
      : [],
    webDomainTokens: counts.webDomainCount
      ? [{ id: selectionId, bundleIdentifier: 'selected.domains', displayName: `${counts.webDomainCount} Selected Domains` }]
      : [],
  };
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncSlice {
  lastSyncTime: string | null;
  isSyncing: boolean;
  syncError: string | null;
  offlineQueueSize: number;
  syncStatus: SyncStatus;

  triggerSync: () => Promise<void>;
  pullAndApply: () => Promise<void>;
  initialUpload: () => Promise<void>;
  pullFromCloud: () => Promise<any>;
  /**
   * Cloud-truth check for whether the signed-in account has completed onboarding.
   * Returns true/false from the cloud, or null on error. Used by the onboarding
   * sign-in button to decide whether to enter the app or keep a brand-new account
   * in onboarding. Lightweight (single column) — not a full pull.
   */
  fetchOnboardingCompleted: () => Promise<boolean | null>;
  /** Push current settings (incl. hasSeenOnboarding) to the cloud immediately. */
  syncSettings: () => Promise<void>;
  flushOfflineQueue: () => Promise<void>;
  updateQueueSize: () => Promise<void>;
  clearSyncError: () => void;
}

export const createSyncSlice = (set: any, get: any): SyncSlice => ({
  lastSyncTime: null,
  isSyncing: false,
  syncError: null,
  offlineQueueSize: 0,
  syncStatus: 'idle',

  triggerSync: async () => {
    const state = get();
    if (!state.auth.isAuthenticated || state.sync.isSyncing) return;

    set((s: any) => ({
      sync: { ...s.sync, isSyncing: true, syncStatus: 'syncing', syncError: null },
    }));

    try {
      // Flush any pending offline operations
      await SyncService.flush();

      // Pull latest from cloud and merge
      const userId = state.auth.user?.id;
      if (!userId) throw new Error('No user ID');

      const remoteData = await SyncService.pullAll(userId);

      // Build local settings from unified store
      const { useUnifiedStore } = require('../unified-store');
      const localPrefs = useUnifiedStore.getState().preferences;

      const localData = {
        focus: {
          sessions: state.focus.sessions,
          tags: state.focus.tags,
          goals: state.focus.goals,
          todos: state.focus.todos ?? { byId: {}, allIds: [] },
          badges: state.focus.badges ?? { byId: {}, allIds: [] },
          coachReports: state.focus.coachReports ?? { byId: {}, allIds: [] },
        },
        rewards: {
          balance: state.rewards.balance,
          totalEarned: state.rewards.totalEarned,
          totalSpent: state.rewards.totalSpent,
          tasks: state.rewards.tasks,
          unlockHistory: state.rewards.unlockHistory ?? {},
          updatedAt: state.rewards.updatedAt,
        },
        settings: localPrefs ? {
          ...localPrefs,
          lastDurationByTagId: state.focus.lastDurationByTagId ?? {},
          updatedAt: localPrefs.updatedAt ?? null,
        } : null,
      };

      const merged = SyncService.merge(localData, remoteData);

      // Apply merged state — preserve functions/metadata by spreading existing slices
      set((s: any) => ({
        focus: {
          ...s.focus,
          sessions: {
            ...s.focus.sessions,
            byId: merged.focus.sessions.byId,
            allIds: merged.focus.sessions.allIds,
          },
          tags: {
            ...s.focus.tags,
            byId: merged.focus.tags.byId,
            allIds: merged.focus.tags.allIds,
          },
          goals: {
            ...s.focus.goals,
            byId: merged.focus.goals.byId,
            allIds: merged.focus.goals.allIds,
          },
          todos: {
            ...s.focus.todos,
            byId: merged.focus.todos.byId,
            allIds: merged.focus.todos.allIds,
          },
          badges: {
            ...s.focus.badges,
            byId: merged.focus.badges.byId,
            allIds: merged.focus.badges.allIds,
          },
          coachReports: {
            ...s.focus.coachReports,
            byId: merged.focus.coachReports.byId,
            allIds: merged.focus.coachReports.allIds,
          },
          // Apply lastDurationByTagId from merged settings if remote won
          ...(merged.settings?.lastDurationByTagId ? { lastDurationByTagId: merged.settings.lastDurationByTagId } : {}),
        },
        rewards: {
          ...s.rewards,
          balance: merged.rewards.balance,
          totalEarned: merged.rewards.totalEarned,
          totalSpent: merged.rewards.totalSpent,
          tasks: merged.rewards.tasks,
          unlockHistory: merged.rewards.unlockHistory ?? {},
        },
        // Referral: LWW — remote always has authoritative count from DB
        referral: {
          ...s.referral,
          referralCode: remoteData.referral?.referralCode ?? s.referral.referralCode,
          referralCount: remoteData.referral?.referralCount ?? s.referral.referralCount,
          claimedTier: remoteData.referral?.claimedTier ?? s.referral.claimedTier,
        },
        sync: {
          ...s.sync,
          isSyncing: false,
          syncStatus: 'idle',
          lastSyncTime: new Date().toISOString(),
          offlineQueueSize: 0,
        },
      }));

      // Enforce 1:1 tag-goal invariant after merge
      reconcileGoals(set, get);

      // Write the merge result back to the cloud. The store apply above relies on
      // the sync middleware to upload local changes, but the middleware diffs by
      // object reference against a baseline that already holds these same local
      // objects, so it never detects local-only / local-newer rows (e.g. a session
      // created then force-quit before its debounced upload) — they'd live on this
      // device only and vanish on reinstall. Push them explicitly here so cold-start
      // merge actually "writes finalized to cloud" as the sync philosophy requires.
      await pushLocalWinsToCloud(merged, remoteData, userId);

      // Apply merged settings to unified store if remote won
      if (merged.settings && merged.settings !== localPrefs) {
        const { updatedAt, lastDurationByTagId: _, ...prefsToApply } = merged.settings;
        useUnifiedStore.getState().updatePreferences(prefsToApply);
        console.log('☁️ Applied remote settings to unified store');
      }

      // Sync blocklist (3-way merge)
      try {
        const currentSelectionId = get().blocklist.currentSelectionId;

        // Check if there's an active (non-expired) unlock session.
        // If so, still sync the blob data but skip native blockSelection()
        // so we don't re-block apps during an unlock. The updated blob is
        // stored under the canonical selection ID and will be used when
        // the unlock expires and the native intervalDidEnd fires.
        const hasActiveUnlock = Object.values(get().blocklist.activeSessions.byId).some(
          (s: any) => s.isActive && new Date(s.endTime) > new Date()
        );
        if (hasActiveUnlock) {
          console.log('☁️ Active unlock session detected — syncing data but skipping blockSelection');
        }

        const newSelectionId = await BlocklistSyncService.sync(userId, currentSelectionId, hasActiveUnlock);
        if (newSelectionId) {
          const counts = BlocklistSyncService.getCounts(newSelectionId);
          set((s: any) => ({
            blocklist: {
              ...s.blocklist,
              currentSelectionId: newSelectionId,
              settings: {
                ...s.blocklist.settings,
                blockedApps: buildLegacySelection(newSelectionId, counts),
              },
            },
          }));
          // Sync to UserDefaults so native intent can re-block if needed
          WidgetService.syncCurrentSelectionId(newSelectionId);
          // Update shield UI with current balance
          const currentBalance = get().rewards.balance;
          await FamilyControlsModule.updateShieldBalance(currentBalance);
          console.log('☁️ Blocklist synced and applied');
        } else if (currentSelectionId) {
          // No data change, but re-apply native blocking in case it was
          // cleared on cold start / app restart
          BlocklistSyncService.reapplyBlocking(currentSelectionId, hasActiveUnlock);
          const currentBalance = get().rewards.balance;
          await FamilyControlsModule.updateShieldBalance(currentBalance);
          console.log('☁️ Blocklist unchanged — re-applied native blocking');
        }
      } catch (error) {
        console.error('[Sync] Blocklist sync error:', error);
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      set((s: any) => ({
        sync: {
          ...s.sync,
          isSyncing: false,
          syncStatus: 'error',
          syncError: error.message || 'Sync failed',
        },
      }));
    }
  },

  /**
   * Pull from cloud and apply directly — no merge.
   * Used on reinstall/sign-in (SIGNED_IN) where cloud is source of truth.
   */
  pullAndApply: async () => {
    const state = get();
    if (!state.auth.isAuthenticated) return;

    const userId = state.auth.user?.id;
    if (!userId) return;

    set((s: any) => ({
      sync: { ...s.sync, isSyncing: true, syncStatus: 'syncing', syncError: null },
    }));

    try {
      const remoteData = await SyncService.pullAll(userId);

      // Drop the diff baseline so the apply below re-baselines to this cloud data
      // instead of the middleware seeing every pulled row as a brand-new local row and
      // re-enqueuing all of it for upload. Without this, signing into an existing account
      // queues ~all cloud sessions; an immediate sign-out then flushes them with no
      // session and they all fail RLS.
      invalidateSyncSnapshot();

      // Clear local data and apply cloud data directly
      set((s: any) => ({
        focus: {
          ...s.focus,
          sessions: {
            ...s.focus.sessions,
            byId: remoteData.focus.sessions.byId,
            allIds: remoteData.focus.sessions.allIds,
          },
          tags: {
            ...s.focus.tags,
            byId: remoteData.focus.tags.byId,
            allIds: remoteData.focus.tags.allIds,
          },
          goals: {
            ...s.focus.goals,
            byId: remoteData.focus.goals.byId,
            allIds: remoteData.focus.goals.allIds,
          },
          todos: {
            ...s.focus.todos,
            byId: remoteData.focus.todos?.byId ?? {},
            allIds: remoteData.focus.todos?.allIds ?? [],
          },
          badges: {
            ...s.focus.badges,
            byId: remoteData.focus.badges?.byId ?? {},
            allIds: remoteData.focus.badges?.allIds ?? [],
          },
          coachReports: {
            ...s.focus.coachReports,
            byId: remoteData.focus.coachReports?.byId ?? {},
            allIds: remoteData.focus.coachReports?.allIds ?? [],
          },
          // Restore per-tag durations from cloud settings
          lastDurationByTagId: remoteData.settings?.lastDurationByTagId ?? {},
        },
        rewards: {
          ...s.rewards,
          balance: remoteData.rewards.balance,
          totalEarned: remoteData.rewards.totalEarned,
          totalSpent: remoteData.rewards.totalSpent,
          // Cloud-wins on aggregates, but OR-merge tasks so a locally-detected setup
          // isn't erased by a stale cloud row.
          tasks: mergeSetupTasks(s.rewards.tasks, remoteData.rewards.tasks),
          unlockHistory: remoteData.rewards.unlockHistory ?? {},
          updatedAt: remoteData.rewards.updatedAt,
        },
        referral: {
          ...s.referral,
          referralCode: remoteData.referral?.referralCode ?? null,
          referralCount: remoteData.referral?.referralCount ?? 0,
          claimedTier: remoteData.referral?.claimedTier ?? 0,
        },
        sync: {
          ...s.sync,
          isSyncing: false,
          syncStatus: 'idle',
          lastSyncTime: new Date().toISOString(),
          offlineQueueSize: 0,
        },
      }));

      // Enforce 1:1 tag-goal invariant after pull
      reconcileGoals(set, get);

      // Apply settings to unified store
      if (remoteData.settings) {
        const { useUnifiedStore } = require('../unified-store');
        const { updatedAt, lastDurationByTagId: _, ...prefsToApply } = remoteData.settings;
        useUnifiedStore.getState().updatePreferences(prefsToApply);
        console.log('☁️ Applied cloud settings to unified store');
      }

      // Apply blocklist from cloud (source of truth)
      try {
        if (remoteData.blocklistBlob) {
          const oldSelectionId = get().blocklist.currentSelectionId;
          const hasActiveUnlock = Object.values(get().blocklist.activeSessions.byId).some(
            (s: any) => s.isActive && new Date(s.endTime) > new Date()
          );
          if (hasActiveUnlock) {
            console.log('☁️ Active unlock session detected — importing data but skipping blockSelection');
          }
          const newSelectionId = await BlocklistSyncService.importAndApply(
            remoteData.blocklistBlob,
            oldSelectionId,
            hasActiveUnlock
          );
          const counts = BlocklistSyncService.getCounts(newSelectionId);
          set((s: any) => ({
            blocklist: {
              ...s.blocklist,
              currentSelectionId: newSelectionId,
              settings: {
                ...s.blocklist.settings,
                blockedApps: buildLegacySelection(newSelectionId, counts),
              },
            },
          }));
          // Sync to UserDefaults so native intent can re-block if needed
          WidgetService.syncCurrentSelectionId(newSelectionId);
          // Update shield UI with current balance
          const currentBalance = get().rewards.balance;
          await FamilyControlsModule.updateShieldBalance(currentBalance);
          console.log('☁️ Blocklist pulled and applied from cloud');
        }
      } catch (error) {
        console.error('[Sync] Blocklist pull-and-apply error:', error);
      }

      console.log('☁️ Pull and apply complete');
    } catch (error: any) {
      console.error('Pull and apply error:', error);
      set((s: any) => ({
        sync: {
          ...s.sync,
          isSyncing: false,
          syncStatus: 'error',
          syncError: error.message || 'Pull and apply failed',
        },
      }));
    }
  },

  initialUpload: async () => {
    const state = get();
    const userId = state.auth.user?.id;
    if (!userId) return;

    set((s: any) => ({
      sync: { ...s.sync, isSyncing: true, syncStatus: 'syncing' },
    }));

    try {
      // Include unified store settings in the upload payload
      const { useUnifiedStore } = require('../unified-store');
      const preferences = useUnifiedStore.getState().preferences;
      const stateWithSettings = { ...state, settings: preferences };
      await SyncService.initialUpload(stateWithSettings, userId);
      set((s: any) => ({
        sync: {
          ...s.sync,
          isSyncing: false,
          syncStatus: 'idle',
          lastSyncTime: new Date().toISOString(),
        },
      }));
    } catch (error: any) {
      console.error('Initial upload error:', error);
      set((s: any) => ({
        sync: {
          ...s.sync,
          isSyncing: false,
          syncStatus: 'error',
          syncError: error.message || 'Initial upload failed',
        },
      }));
    }
  },

  pullFromCloud: async () => {
    const state = get();
    const userId = state.auth.user?.id;
    if (!userId) return null;

    try {
      return await SyncService.pullAll(userId);
    } catch (error: any) {
      console.error('Pull from cloud error:', error);
      return null;
    }
  },

  fetchOnboardingCompleted: async () => {
    const userId = get().auth.user?.id;
    if (!userId) return null;
    try {
      // maybeSingle: a brand-new account has no user_settings row yet (the signup
      // trigger seeds only profiles + rewards), so no row → not onboarded.
      const { data, error } = await supabase
        .from('user_settings')
        .select('has_seen_onboarding')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data?.has_seen_onboarding ?? false;
    } catch (error: any) {
      console.error('[Sync] fetchOnboardingCompleted error:', error);
      return null;
    }
  },

  syncSettings: async () => {
    const state = get();
    if (!state.auth.isAuthenticated) return;
    const userId = state.auth.user?.id;
    if (!userId) return;
    try {
      const { useUnifiedStore } = require('../unified-store');
      const prefs = useUnifiedStore.getState().preferences;
      const row = settingsToRow(prefs, userId, state.focus?.lastDurationByTagId);
      await SyncService.enqueue('user_settings', 'upsert', row);
      await SyncService.flush();
    } catch (error: any) {
      console.error('[Sync] syncSettings error:', error);
    }
  },

  flushOfflineQueue: async () => {
    const state = get();
    if (!state.auth.isAuthenticated) return;

    try {
      const result = await SyncService.flush();
      set((s: any) => ({
        sync: { ...s.sync, offlineQueueSize: syncQueue.size },
      }));
      if (result.flushed > 0) {
        console.log(`☁️ Flushed ${result.flushed} offline operations`);
      }
    } catch (error: any) {
      console.error('Flush offline queue error:', error);
    }
  },

  updateQueueSize: async () => {
    await syncQueue.load();
    set((s: any) => ({
      sync: { ...s.sync, offlineQueueSize: syncQueue.size },
    }));
  },

  clearSyncError: () => {
    set((s: any) => ({
      sync: { ...s.sync, syncError: null, syncStatus: 'idle' },
    }));
  },
});

/**
 * Enqueue every row where the LOCAL side won the cold-start merge, then flush.
 *
 * mergeNormalized keeps the local object reference for local-only and local-newer
 * rows, and the remote object reference when remote wins. So `merged.byId[id] !==
 * remote.byId[id]` is an exact test for "this row needs to be pushed up" — it's true
 * only for local-only rows (remote has none) and local-newer rows (local won LWW),
 * and false for remote-only / remote-won rows that are already in the cloud.
 *
 * Tags are enqueued before sessions/goals/badges so the focus_sessions.tag_id FK is
 * satisfied (flush also priority-orders session_tags first). Idempotent: the queue
 * dedupes by id and upserts are merge-duplicates.
 */
async function pushLocalWinsToCloud(merged: any, remoteData: any, userId: string): Promise<void> {
  const enqueueLocalWins = async (
    table: string,
    mergedList: { byId: Record<string, any>; allIds: string[] },
    remoteById: Record<string, any>,
    mapFn: (item: any) => Record<string, any>
  ) => {
    let count = 0;
    for (const id of mergedList.allIds) {
      const item = mergedList.byId[id];
      if (item && item !== remoteById[id]) {
        await SyncService.enqueue(table, 'upsert', mapFn(item));
        count++;
      }
    }
    return count;
  };

  try {
    const tagsPushed = await enqueueLocalWins(
      'session_tags',
      merged.focus.tags,
      remoteData.focus.tags.byId,
      (t) => tagToRow(t, userId)
    );
    const sessionsPushed = await enqueueLocalWins(
      'focus_sessions',
      merged.focus.sessions,
      remoteData.focus.sessions.byId,
      (s) => sessionToRow(s, userId)
    );
    const goalsPushed = await enqueueLocalWins(
      'focus_goals',
      merged.focus.goals,
      remoteData.focus.goals.byId,
      (g) => goalToRow(g, userId)
    );
    const todosPushed = await enqueueLocalWins(
      'todos',
      merged.focus.todos ?? { byId: {}, allIds: [] },
      remoteData.focus.todos?.byId ?? {},
      (t) => todoToRow(t, userId)
    );
    const badgesPushed = await enqueueLocalWins(
      'badges',
      merged.focus.badges ?? { byId: {}, allIds: [] },
      remoteData.focus.badges?.byId ?? {},
      (b) => badgeToRow(b, userId)
    );
    const coachReportsPushed = await enqueueLocalWins(
      'coach_reports',
      merged.focus.coachReports ?? { byId: {}, allIds: [] },
      remoteData.focus.coachReports?.byId ?? {},
      (r) => coachReportToRow(r, userId)
    );
    const mergedDurations = merged.settings?.lastDurationByTagId ?? {};
    const remoteDurations = remoteData.settings?.lastDurationByTagId ?? {};
    const settingsPushed =
      JSON.stringify(mergedDurations) !== JSON.stringify(remoteDurations) && merged.settings
        ? 1
        : 0;

    if (settingsPushed) {
      await SyncService.enqueue(
        'user_settings',
        'upsert',
        settingsToRow(merged.settings, userId, mergedDurations)
      );
    }

    if (
      tagsPushed +
        sessionsPushed +
        goalsPushed +
        todosPushed +
        badgesPushed +
        coachReportsPushed +
        settingsPushed ===
      0
    ) {
      console.log('[triggerSync] No local-wins to push to cloud');
      return;
    }

    console.log(
      `[triggerSync] Pushing local-wins — tags:${tagsPushed} sessions:${sessionsPushed} goals:${goalsPushed} todos:${todosPushed} badges:${badgesPushed} coachReports:${coachReportsPushed} settings:${settingsPushed}`
    );
    const result = await SyncService.flush();
    console.log(`[triggerSync] Local-wins flush — flushed:${result.flushed} failed:${result.failed}`);
  } catch (error) {
    console.error('[triggerSync] pushLocalWinsToCloud error:', error);
  }
}

/**
 * Collapse duplicate goals that share a tagId down to a single winner
 * (active first, then most-recently-updated). Called after sync pulls/merges,
 * which can briefly produce duplicate goals for the same tag.
 */
export function reconcileGoals(set: any, get: any): void {
  const goals = get().focus.goals;
  const byTagId: Record<string, any[]> = {};

  // Group goals by tagId
  for (const id of goals.allIds) {
    const goal = goals.byId[id];
    if (!goal) continue;
    const tagId = goal.tagId;
    if (!tagId) continue;
    if (!byTagId[tagId]) byTagId[tagId] = [];
    byTagId[tagId].push(goal);
  }

  // Check if there are any duplicates at all
  const hasDuplicates = Object.values(byTagId).some((arr) => arr.length > 1);
  if (!hasDuplicates) return;

  // Pick the winner for each tagId group and collect IDs to remove
  const idsToRemove = new Set<string>();

  for (const [, groupGoals] of Object.entries(byTagId)) {
    if (groupGoals.length <= 1) continue;

    // Sort: active first, then by updatedAt descending
    groupGoals.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const aTime = new Date(a.updatedAt || 0).getTime();
      const bTime = new Date(b.updatedAt || 0).getTime();
      return bTime - aTime;
    });

    // Keep the first (winner), remove the rest
    for (let i = 1; i < groupGoals.length; i++) {
      idsToRemove.add(groupGoals[i].id);
    }
  }

  if (idsToRemove.size === 0) return;

  console.log(`[reconcileGoals] Removing ${idsToRemove.size} duplicate goal(s)`);

  set((s: any) => {
    const newById = { ...s.focus.goals.byId };
    for (const id of idsToRemove) {
      delete newById[id];
    }
    const newAllIds = s.focus.goals.allIds.filter((id: string) => !idsToRemove.has(id));
    return {
      focus: {
        ...s.focus,
        goals: {
          ...s.focus.goals,
          byId: newById,
          allIds: newAllIds,
        },
      },
    };
  });
}
