import { SyncService } from '../../services/sync/SyncService';
import { BlocklistSyncService } from '../../services/sync/BlocklistSyncService';
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

// Accumulated change flags across debounce resets
let pendingChanges = { sessions: false, tags: false, goals: false, rewards: false, blocklist: false };

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
      console.log(`[SyncMW] Initial snapshot — sessions:${Object.keys(lastSyncedSnapshot.sessions).length} tags:${Object.keys(lastSyncedSnapshot.tags).length} goals:${Object.keys(lastSyncedSnapshot.goals).length}`);
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
    const blocklistChanged =
      state.blocklist.currentSelectionId !== prevState.blocklist?.currentSelectionId;

    if (!sessionsChanged && !tagsChanged && !goalsChanged && !rewardsChanged && !blocklistChanged) {
      return;
    }

    // Accumulate change flags so earlier changes survive debounce resets
    if (sessionsChanged) pendingChanges.sessions = true;
    if (tagsChanged) pendingChanges.tags = true;
    if (goalsChanged) pendingChanges.goals = true;
    if (rewardsChanged) pendingChanges.rewards = true;
    if (blocklistChanged) pendingChanges.blocklist = true;

    console.log(`[SyncMW] Change detected — sessions:${sessionsChanged} tags:${tagsChanged} goals:${goalsChanged} rewards:${rewardsChanged} blocklist:${blocklistChanged} (pending: sessions:${pendingChanges.sessions} tags:${pendingChanges.tags} goals:${pendingChanges.goals} rewards:${pendingChanges.rewards} blocklist:${pendingChanges.blocklist})`);

    // Debounce sync operations
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      // Capture and reset pending changes
      const changes = { ...pendingChanges };
      pendingChanges = { sessions: false, tags: false, goals: false, rewards: false, blocklist: false };

      console.log(`[SyncMW] Debounce fired — processing: sessions:${changes.sessions} tags:${changes.tags} goals:${changes.goals} rewards:${changes.rewards}`);
      try {
        // Diff sessions
        if (changes.sessions) {
          const oldIds = Object.keys(lastSyncedSnapshot!.sessions);
          const newIds = Object.keys(state.focus.sessions.byId);
          console.log(`[SyncMW] Sessions diff — old:${oldIds.length} new:${newIds.length}`);
          await diffAndEnqueue(
            'focus_sessions',
            lastSyncedSnapshot!.sessions,
            state.focus.sessions.byId,
            (item: any) => sessionToRow(item, userId)
          );
        }

        // Diff tags
        if (changes.tags) {
          await diffAndEnqueue(
            'session_tags',
            lastSyncedSnapshot!.tags,
            state.focus.tags.byId,
            (item: any) => tagToRow(item, userId)
          );
        }

        // Diff goals
        if (changes.goals) {
          await diffAndEnqueue(
            'focus_goals',
            lastSyncedSnapshot!.goals,
            state.focus.goals.byId,
            (item: any) => goalToRow(item, userId)
          );
        }

        // Rewards — just upsert the whole row
        if (changes.rewards) {
          const rewardsRow = rewardsToRow(state.rewards, userId);
          await SyncService.enqueue('rewards', 'upsert', rewardsRow);
        }

        // Blocklist — push current blob to cloud (push-only, not full merge)
        if (changes.blocklist) {
          const selectionId = state.blocklist.currentSelectionId;
          if (selectionId) {
            console.log('[SyncMW] Pushing blocklist change to cloud');
            await BlocklistSyncService.push(userId, selectionId);
          }
        }

        // Update snapshot
        lastSyncedSnapshot = takeSnapshot(state);
        console.log(`[SyncMW] Snapshot updated, flushing...`);

        // Attempt to flush immediately
        const result = await SyncService.flush();
        console.log(`[SyncMW] Flush result — flushed:${result.flushed} failed:${result.failed}`);

        // Update queue size in store
        store.getState().sync?.updateQueueSize?.();
      } catch (error) {
        console.error('[SyncMW] Middleware error:', error);
      }
    }, DEBOUNCE_MS);
  });

  return () => {
    unsubscribe();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pendingChanges = { sessions: false, tags: false, goals: false, rewards: false, blocklist: false };
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
  let upsertCount = 0;
  let deleteCount = 0;

  // New or updated items
  for (const id of Object.keys(newById)) {
    if (!oldById[id] || newById[id] !== oldById[id]) {
      const row = mapFn(newById[id]);
      const isNew = !oldById[id];
      console.log(`[SyncMW] ${table} ${isNew ? 'NEW' : 'UPDATED'}: ${id} → row keys: [${Object.keys(row).join(', ')}]`);
      if (table === 'focus_sessions') {
        console.log(`[SyncMW]   duration=${row.duration} start_time=${row.start_time} end_time=${row.end_time} tag_id=${row.tag_id}`);
      }
      await SyncService.enqueue(table, 'upsert', row);
      upsertCount++;
    }
  }

  // Deleted items (present in old, missing in new)
  for (const id of Object.keys(oldById)) {
    if (!newById[id]) {
      console.log(`[SyncMW] ${table} DELETED: ${id}`);
      await SyncService.enqueue(table, 'soft_delete', { id });
      deleteCount++;
    }
  }

  console.log(`[SyncMW] ${table} diff complete — ${upsertCount} upserts, ${deleteCount} deletes`);
}

/**
 * Reset the sync snapshot (call on sign-out).
 */
export function resetSyncSnapshot(): void {
  lastSyncedSnapshot = null;
  pendingChanges = { sessions: false, tags: false, goals: false, rewards: false, blocklist: false };
  // Clear blocklist sync baseline on sign-out
  BlocklistSyncService.clearBaseline();
}
