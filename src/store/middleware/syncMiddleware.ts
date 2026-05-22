import { SyncService } from '../../services/sync/SyncService';
import {
  sessionToRow,
  tagToRow,
  goalToRow,
  rewardsToRow,
} from '../../services/sync/SyncMapper';

/**
 * Zustand middleware that transparently enqueues sync operations
 * when syncable slices change and user is authenticated.
 *
 * Uses subscribe() — does NOT modify slice code at all.
 */

let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 2000;

// Snapshot of last-synced state for diffing
let lastSyncedSnapshot: {
  sessions: Record<string, any>;
  tags: Record<string, any>;
  goals: Record<string, any>;
  rewards: { balance: number; totalEarned: number; totalSpent: number };
} | null = null;

export function initSyncMiddleware(store: any): () => void {
  const unsubscribe = store.subscribe((state: any, prevState: any) => {
    if (!state.auth?.isAuthenticated || !state.auth?.user?.id) return;

    const userId = state.auth.user.id;

    // Initialize snapshot on first run
    if (!lastSyncedSnapshot) {
      lastSyncedSnapshot = takeSnapshot(state);
      return;
    }

    // Check if syncable slices changed
    const sessionsChanged = state.focus.sessions !== prevState.focus?.sessions;
    const tagsChanged = state.focus.tags !== prevState.focus?.tags;
    const goalsChanged = state.focus.goals !== prevState.focus?.goals;
    const rewardsChanged =
      state.rewards.balance !== prevState.rewards?.balance ||
      state.rewards.totalEarned !== prevState.rewards?.totalEarned ||
      state.rewards.totalSpent !== prevState.rewards?.totalSpent;

    if (!sessionsChanged && !tagsChanged && !goalsChanged && !rewardsChanged) {
      return;
    }

    // Debounce sync operations
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      try {
        // Diff sessions
        if (sessionsChanged) {
          await diffAndEnqueue(
            'focus_sessions',
            lastSyncedSnapshot!.sessions,
            state.focus.sessions.byId,
            (item: any) => sessionToRow(item, userId)
          );
        }

        // Diff tags
        if (tagsChanged) {
          await diffAndEnqueue(
            'session_tags',
            lastSyncedSnapshot!.tags,
            state.focus.tags.byId,
            (item: any) => tagToRow(item, userId)
          );
        }

        // Diff goals
        if (goalsChanged) {
          await diffAndEnqueue(
            'focus_goals',
            lastSyncedSnapshot!.goals,
            state.focus.goals.byId,
            (item: any) => goalToRow(item, userId)
          );
        }

        // Rewards — just upsert the whole row
        if (rewardsChanged) {
          const rewardsRow = rewardsToRow(state.rewards, userId);
          await SyncService.enqueue('rewards', 'upsert', rewardsRow);
        }

        // Update snapshot
        lastSyncedSnapshot = takeSnapshot(state);

        // Attempt to flush immediately
        await SyncService.flush();

        // Update queue size in store
        store.getState().sync?.updateQueueSize?.();
      } catch (error) {
        console.error('Sync middleware error:', error);
      }
    }, DEBOUNCE_MS);
  });

  return () => {
    unsubscribe();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    lastSyncedSnapshot = null;
  };
}

function takeSnapshot(state: any) {
  return {
    sessions: { ...state.focus.sessions.byId },
    tags: { ...state.focus.tags.byId },
    goals: { ...state.focus.goals.byId },
    rewards: {
      balance: state.rewards.balance,
      totalEarned: state.rewards.totalEarned,
      totalSpent: state.rewards.totalSpent,
    },
  };
}

async function diffAndEnqueue(
  table: string,
  oldById: Record<string, any>,
  newById: Record<string, any>,
  mapFn: (item: any) => Record<string, any>
): Promise<void> {
  // New or updated items
  for (const id of Object.keys(newById)) {
    if (!oldById[id] || newById[id] !== oldById[id]) {
      const row = mapFn(newById[id]);
      await SyncService.enqueue(table, 'upsert', row);
    }
  }

  // Deleted items (present in old, missing in new)
  for (const id of Object.keys(oldById)) {
    if (!newById[id]) {
      await SyncService.enqueue(table, 'soft_delete', { id });
    }
  }
}

/**
 * Reset the sync snapshot (call on sign-out).
 */
export function resetSyncSnapshot(): void {
  lastSyncedSnapshot = null;
}
