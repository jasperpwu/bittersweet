import { SyncService } from '../../services/sync/SyncService';
import { syncQueue } from '../../services/sync/SyncQueue';
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
          badges: state.focus.badges ?? { byId: {}, allIds: [] },
        },
        rewards: {
          balance: state.rewards.balance,
          totalEarned: state.rewards.totalEarned,
          totalSpent: state.rewards.totalSpent,
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
          badges: {
            ...s.focus.badges,
            byId: merged.focus.badges.byId,
            allIds: merged.focus.badges.allIds,
          },
          // Apply lastDurationByTagId from merged settings if remote won
          ...(merged.settings?.lastDurationByTagId ? { lastDurationByTagId: merged.settings.lastDurationByTagId } : {}),
        },
        rewards: {
          ...s.rewards,
          balance: merged.rewards.balance,
          totalEarned: merged.rewards.totalEarned,
          totalSpent: merged.rewards.totalSpent,
        },
        sync: {
          ...s.sync,
          isSyncing: false,
          syncStatus: 'idle',
          lastSyncTime: new Date().toISOString(),
          offlineQueueSize: 0,
        },
      }));

      // Apply merged settings to unified store if remote won
      if (merged.settings && merged.settings !== localPrefs) {
        const { updatedAt, lastDurationByTagId: _, ...prefsToApply } = merged.settings;
        useUnifiedStore.getState().updatePreferences(prefsToApply);
        console.log('☁️ Applied remote settings to unified store');
      }

      // Sync blocklist (3-way merge)
      try {
        const currentSelectionId = get().blocklist.currentSelectionId;
        const newSelectionId = await BlocklistSyncService.sync(userId, currentSelectionId);
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
          badges: {
            ...s.focus.badges,
            byId: remoteData.focus.badges?.byId ?? {},
            allIds: remoteData.focus.badges?.allIds ?? [],
          },
          // Restore per-tag durations from cloud settings
          lastDurationByTagId: remoteData.settings?.lastDurationByTagId ?? {},
        },
        rewards: {
          ...s.rewards,
          balance: remoteData.rewards.balance,
          totalEarned: remoteData.rewards.totalEarned,
          totalSpent: remoteData.rewards.totalSpent,
          updatedAt: remoteData.rewards.updatedAt,
        },
        sync: {
          ...s.sync,
          isSyncing: false,
          syncStatus: 'idle',
          lastSyncTime: new Date().toISOString(),
          offlineQueueSize: 0,
        },
      }));

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
          const newSelectionId = await BlocklistSyncService.importAndApply(
            remoteData.blocklistBlob,
            oldSelectionId
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
