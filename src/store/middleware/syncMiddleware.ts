import { SyncService } from '../../services/sync/SyncService';
import { syncQueue } from '../../services/sync/SyncQueue';
import { BlocklistSyncService } from '../../services/sync/BlocklistSyncService';
import {
  sessionToRow,
  tagToRow,
  goalToRow,
  rewardsToRow,
  badgeToRow,
  settingsToRow,
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
let pendingChanges = { sessions: false, tags: false, goals: false, badges: false, rewards: false, blocklist: false, settings: false };

// Snapshot of last-synced state for diffing
let lastSyncedSnapshot: {
  sessions: Record<string, any>;
  tags: Record<string, any>;
  goals: Record<string, any>;
  badges: Record<string, any>;
  rewards: { balance: number; totalEarned: number; totalSpent: number };
} | null = null;

// Track last-synced settings to detect changes (from unified store)
let lastSyncedSettings: any = null;

let settingsDebounceTimer: NodeJS.Timeout | null = null;

export function initSyncMiddleware(store: any): () => void {
  // Subscribe to unified store for settings changes
  const { useUnifiedStore } = require('../unified-store');
  const unsubSettings = useUnifiedStore.subscribe((state: any, prevState: any) => {
    // Only sync if main store user is authenticated
    const mainState = store.getState();
    if (!mainState.auth?.isAuthenticated || !mainState.auth?.user?.id) return;

    // Compare preferences reference
    if (state.preferences === prevState.preferences) return;

    // Initialize baseline on first change
    if (!lastSyncedSettings) {
      lastSyncedSettings = state.preferences;
      return;
    }

    // Debounce settings sync (same 2s window)
    if (settingsDebounceTimer) clearTimeout(settingsDebounceTimer);
    settingsDebounceTimer = setTimeout(async () => {
      try {
        const mainState = store.getState();
        const userId = mainState.auth.user.id;
        const currentPrefs = useUnifiedStore.getState().preferences;
        const row = settingsToRow(currentPrefs, userId, mainState.focus?.lastDurationByTagId);
        await SyncService.enqueue('user_settings', 'upsert', row);
        lastSyncedSettings = currentPrefs;
        console.log('[SyncMW] Settings change enqueued');

        const result = await SyncService.flush();
        console.log(`[SyncMW] Settings flush — flushed:${result.flushed} failed:${result.failed}`);
        store.getState().sync?.updateQueueSize?.();
      } catch (error) {
        console.error('[SyncMW] Settings sync error:', error);
      }
    }, DEBOUNCE_MS);
  });

  const unsubscribe = store.subscribe((state: any, prevState: any) => {
    if (!state.auth?.isAuthenticated || !state.auth?.user?.id) return;

    const userId = state.auth.user.id;

    // Initialize snapshot on first run
    if (!lastSyncedSnapshot) {
      lastSyncedSnapshot = takeSnapshot(state);
      console.log(`[SyncMW] Initial snapshot — sessions:${Object.keys(lastSyncedSnapshot.sessions).length} tags:${Object.keys(lastSyncedSnapshot.tags).length} goals:${Object.keys(lastSyncedSnapshot.goals).length} badges:${Object.keys(lastSyncedSnapshot.badges).length}`);
      return;
    }

    // Check if syncable slices changed
    const sessionsChanged = state.focus.sessions !== prevState.focus?.sessions;
    const tagsChanged = state.focus.tags !== prevState.focus?.tags;
    const goalsChanged = state.focus.goals !== prevState.focus?.goals;
    const badgesChanged = state.focus.badges !== prevState.focus?.badges;
    const rewardsChanged =
      state.rewards.balance !== prevState.rewards?.balance ||
      state.rewards.totalEarned !== prevState.rewards?.totalEarned ||
      state.rewards.totalSpent !== prevState.rewards?.totalSpent;
    const blocklistChanged =
      state.blocklist.currentSelectionId !== prevState.blocklist?.currentSelectionId;
    const durationByTagChanged =
      state.focus.lastDurationByTagId !== prevState.focus?.lastDurationByTagId;

    if (!sessionsChanged && !tagsChanged && !goalsChanged && !badgesChanged && !rewardsChanged && !blocklistChanged && !durationByTagChanged) {
      return;
    }

    // Accumulate change flags so earlier changes survive debounce resets
    if (sessionsChanged) pendingChanges.sessions = true;
    if (tagsChanged) pendingChanges.tags = true;
    if (goalsChanged) pendingChanges.goals = true;
    if (badgesChanged) pendingChanges.badges = true;
    if (rewardsChanged) pendingChanges.rewards = true;
    if (blocklistChanged) pendingChanges.blocklist = true;
    if (durationByTagChanged) pendingChanges.settings = true;

    console.log(`[SyncMW] Change detected — sessions:${sessionsChanged} tags:${tagsChanged} goals:${goalsChanged} badges:${badgesChanged} rewards:${rewardsChanged} blocklist:${blocklistChanged} durationByTag:${durationByTagChanged} (pending: sessions:${pendingChanges.sessions} tags:${pendingChanges.tags} goals:${pendingChanges.goals} badges:${pendingChanges.badges} rewards:${pendingChanges.rewards} blocklist:${pendingChanges.blocklist} settings:${pendingChanges.settings})`);

    // Debounce sync operations
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      // Capture and reset pending changes
      const changes = { ...pendingChanges };
      pendingChanges = { sessions: false, tags: false, goals: false, badges: false, rewards: false, blocklist: false, settings: false };

      console.log(`[SyncMW] Debounce fired — processing: sessions:${changes.sessions} tags:${changes.tags} goals:${changes.goals} badges:${changes.badges} rewards:${changes.rewards}`);
      try {
        // Diff tags before sessions because focus_sessions.tag_id has a DB
        // foreign key to session_tags.id.
        if (changes.tags) {
          await diffAndEnqueue(
            'session_tags',
            lastSyncedSnapshot!.tags,
            state.focus.tags.byId,
            (item: any) => tagToRow(item, userId)
          );
        }

        // Diff sessions
        if (changes.sessions) {
          const oldIds = Object.keys(lastSyncedSnapshot!.sessions);
          const newIds = Object.keys(state.focus.sessions.byId);
          console.log(`[SyncMW] Sessions diff — old:${oldIds.length} new:${newIds.length}`);
          await diffAndEnqueue(
            'focus_sessions',
            lastSyncedSnapshot!.sessions,
            state.focus.sessions.byId,
            (item: any) => sessionToRow(item, userId),
            async (item: any) => {
              const tag = state.focus.tags.byId[item.tagId];
              if (!tag) {
                console.warn(`[SyncMW] Session ${item.id} references missing local tag ${item.tagId}`);
                return;
              }
              await SyncService.enqueue('session_tags', 'upsert', tagToRow(tag, userId));
            }
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

        // Diff badges
        if (changes.badges) {
          await diffAndEnqueue(
            'badges',
            lastSyncedSnapshot!.badges,
            state.focus.badges?.byId ?? {},
            (item: any) => badgeToRow(item, userId)
          );
        }

        // Rewards — just upsert the whole row
        if (changes.rewards) {
          const rewardsRow = rewardsToRow(state.rewards, userId);
          await SyncService.enqueue('rewards', 'upsert', rewardsRow);
        }

        // Settings — upsert when lastDurationByTagId changes in main store
        if (changes.settings) {
          const currentPrefs = useUnifiedStore.getState().preferences;
          const row = settingsToRow(currentPrefs, userId, state.focus?.lastDurationByTagId);
          await SyncService.enqueue('user_settings', 'upsert', row);
          console.log('[SyncMW] Settings (lastDurationByTagId) change enqueued');
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
    unsubSettings();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (settingsDebounceTimer) {
      clearTimeout(settingsDebounceTimer);
      settingsDebounceTimer = null;
    }
    pendingChanges = { sessions: false, tags: false, goals: false, badges: false, rewards: false, blocklist: false, settings: false };
    lastSyncedSnapshot = null;
    lastSyncedSettings = null;
  };
}

function takeSnapshot(state: any) {
  return {
    sessions: { ...state.focus.sessions.byId },
    tags: { ...state.focus.tags.byId },
    goals: { ...state.focus.goals.byId },
    badges: { ...(state.focus.badges?.byId ?? {}) },
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
  mapFn: (item: any) => Record<string, any>,
  beforeUpsert?: (item: any) => Promise<void>
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
      await beforeUpsert?.(newById[id]);
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
 * Drop the diff baseline and cancel any pending debounced flush — WITHOUT clearing the
 * offline queue. Call this right before applying freshly-pulled cloud data (pullAndApply)
 * so the middleware re-baselines to that cloud data on the next set() instead of diffing
 * it against the prior (often empty) snapshot and re-enqueuing all of it as "new" local
 * rows to push straight back up. Cancelling the pending debounce is correct here because
 * pullAndApply is cloud-wins: any not-yet-flushed local diff is about to be overwritten.
 */
export function invalidateSyncSnapshot(): void {
  lastSyncedSnapshot = null;
  lastSyncedSettings = null;
  pendingChanges = { sessions: false, tags: false, goals: false, badges: false, rewards: false, blocklist: false, settings: false };

  // Cancel any debounced flush already scheduled — otherwise it fires later and (post
  // sign-out) every upsert fails RLS, or it dereferences the now-null snapshot.
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (settingsDebounceTimer) {
    clearTimeout(settingsDebounceTimer);
    settingsDebounceTimer = null;
  }
}

/**
 * Full reset for sign-out / user-switch: drop the baseline AND the queued ops.
 */
export function resetSyncSnapshot(): void {
  invalidateSyncSnapshot();

  // Drop the departing user's queued ops. AsyncStorage.clear() wipes the persisted
  // copy but NOT this in-memory singleton (loaded stays true), so a later flush would
  // otherwise replay these rows — failing RLS post-sign-out, or leaking into the next
  // account on a user switch.
  void syncQueue.clear();

  // Clear blocklist sync baseline on sign-out
  BlocklistSyncService.clearBaseline();
}
