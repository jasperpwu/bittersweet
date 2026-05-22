import { SyncService } from '../../services/sync/SyncService';
import { syncQueue } from '../../services/sync/SyncQueue';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncSlice {
  lastSyncTime: string | null;
  isSyncing: boolean;
  syncError: string | null;
  offlineQueueSize: number;
  syncStatus: SyncStatus;

  triggerSync: () => Promise<void>;
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
      const localData = {
        focus: {
          sessions: state.focus.sessions,
          tags: state.focus.tags,
          goals: state.focus.goals,
        },
        rewards: {
          balance: state.rewards.balance,
          totalEarned: state.rewards.totalEarned,
          totalSpent: state.rewards.totalSpent,
          transactions: state.rewards.transactions,
        },
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
        },
        rewards: {
          ...s.rewards,
          balance: merged.rewards.balance,
          totalEarned: merged.rewards.totalEarned,
          totalSpent: merged.rewards.totalSpent,
          transactions: merged.rewards.transactions,
        },
        sync: {
          ...s.sync,
          isSyncing: false,
          syncStatus: 'idle',
          lastSyncTime: new Date().toISOString(),
          offlineQueueSize: 0,
        },
      }));
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

  initialUpload: async () => {
    const state = get();
    const userId = state.auth.user?.id;
    if (!userId) return;

    set((s: any) => ({
      sync: { ...s.sync, isSyncing: true, syncStatus: 'syncing' },
    }));

    try {
      await SyncService.initialUpload(state, userId);
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
