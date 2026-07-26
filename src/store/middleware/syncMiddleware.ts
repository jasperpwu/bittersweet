import { SyncService } from '../../services/sync/SyncService';
import { syncQueue } from '../../services/sync/SyncQueue';
import { BlocklistSyncService } from '../../services/sync/BlocklistSyncService';
import {
  sessionToRow,
  tagToRow,
  goalToRow,
  todoToRow,
  rewardsToRow,
  badgeToRow,
  coachReportToRow,
  purchaseToRow,
  customRewardToRow,
  settingsToRow,
} from '../../services/sync/SyncMapper';
import { AnalyticsTracker } from '../../services/analytics';

/**
 * Zustand middleware that transparently enqueues sync operations
 * when syncable slices change and user is authenticated.
 *
 * Uses subscribe() — does NOT modify slice code at all.
 */

let debounceTimer: NodeJS.Timeout | null = null;
const DEBOUNCE_MS = 2000;

// Accumulated change flags across debounce resets
let pendingChanges = { sessions: false, tags: false, goals: false, todos: false, badges: false, coachReports: false, rewards: false, purchases: false, customRewards: false, blocklist: false, settings: false };

// Snapshot of last-synced state for diffing
let lastSyncedSnapshot: {
  sessions: Record<string, any>;
  tags: Record<string, any>;
  goals: Record<string, any>;
  todos: Record<string, any>;
  badges: Record<string, any>;
  coachReports: Record<string, any>;
  purchases: Record<string, any>;
  customRewards: Record<string, any>;
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
        const row = settingsToRow(currentPrefs, userId, mainState.focus);
        await SyncService.enqueue('user_settings', 'upsert', row);
        lastSyncedSettings = currentPrefs;

        const result = await SyncService.flush();
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
      return;
    }

    // Check if syncable slices changed
    const sessionsChanged = state.focus.sessions !== prevState.focus?.sessions;
    const tagsChanged = state.focus.tags !== prevState.focus?.tags;
    const goalsChanged = state.focus.goals !== prevState.focus?.goals;
    const todosChanged = state.focus.todos !== prevState.focus?.todos;
    const badgesChanged = state.focus.badges !== prevState.focus?.badges;
    const coachReportsChanged = state.focus.coachReports !== prevState.focus?.coachReports;
    const rewardsChanged =
      state.rewards.balance !== prevState.rewards?.balance ||
      state.rewards.totalEarned !== prevState.rewards?.totalEarned ||
      state.rewards.totalSpent !== prevState.rewards?.totalSpent;
    const purchasesChanged = state.rewards.purchases !== prevState.rewards?.purchases;
    const customRewardsChanged =
      state.rewards.customRewards !== prevState.rewards?.customRewards;
    const blocklistChanged =
      state.blocklist.currentSelectionId !== prevState.blocklist?.currentSelectionId;
    const durationByTagChanged =
      state.focus.lastDurationByTagId !== prevState.focus?.lastDurationByTagId;
    const selectedTagChanged =
      state.focus.lastSelectedTagId !== prevState.focus?.lastSelectedTagId;

    if (!sessionsChanged && !tagsChanged && !goalsChanged && !todosChanged && !badgesChanged && !coachReportsChanged && !rewardsChanged && !purchasesChanged && !customRewardsChanged && !blocklistChanged && !durationByTagChanged && !selectedTagChanged) {
      return;
    }

    // Accumulate change flags so earlier changes survive debounce resets
    if (sessionsChanged) pendingChanges.sessions = true;
    if (tagsChanged) pendingChanges.tags = true;
    if (goalsChanged) pendingChanges.goals = true;
    if (todosChanged) pendingChanges.todos = true;
    if (badgesChanged) pendingChanges.badges = true;
    if (coachReportsChanged) pendingChanges.coachReports = true;
    if (rewardsChanged) pendingChanges.rewards = true;
    if (purchasesChanged) pendingChanges.purchases = true;
    if (customRewardsChanged) pendingChanges.customRewards = true;
    if (blocklistChanged) pendingChanges.blocklist = true;
    if (durationByTagChanged || selectedTagChanged) pendingChanges.settings = true;


    // Debounce sync operations
    if (debounceTimer) clearTimeout(debounceTimer);

    debounceTimer = setTimeout(async () => {
      // Capture and reset pending changes
      const changes = { ...pendingChanges };
      pendingChanges = { sessions: false, tags: false, goals: false, todos: false, badges: false, coachReports: false, rewards: false, purchases: false, customRewards: false, blocklist: false, settings: false };

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

        // Diff todos. tag_id FKs session_tags, so ensure the referenced tag is
        // enqueued first (mirrors the session→tag guard above).
        if (changes.todos) {
          await diffAndEnqueue(
            'todos',
            lastSyncedSnapshot!.todos,
            state.focus.todos.byId,
            (item: any) => todoToRow(item, userId),
            async (item: any) => {
              const tag = state.focus.tags.byId[item.tagId];
              if (tag) {
                await SyncService.enqueue('session_tags', 'upsert', tagToRow(tag, userId));
              }
            }
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

        // Diff coach reports
        if (changes.coachReports) {
          await diffAndEnqueue(
            'coach_reports',
            lastSyncedSnapshot!.coachReports,
            state.focus.coachReports?.byId ?? {},
            (item: any) => coachReportToRow(item, userId)
          );
        }

        // Diff purchases (fruit-store purchase history, list pattern)
        if (changes.purchases) {
          await diffAndEnqueue(
            'purchases',
            lastSyncedSnapshot!.purchases,
            state.rewards.purchases?.byId ?? {},
            (item: any) => purchaseToRow(item, userId)
          );
        }

        // Diff custom rewards (fruit-store Custom tab definitions, list pattern)
        if (changes.customRewards) {
          await diffAndEnqueue(
            'custom_rewards',
            lastSyncedSnapshot!.customRewards,
            state.rewards.customRewards?.byId ?? {},
            (item: any) => customRewardToRow(item, userId)
          );
        }

        // Rewards — just upsert the whole row
        if (changes.rewards) {
          const rewardsRow = rewardsToRow(state.rewards, userId);
          await SyncService.enqueue('rewards', 'upsert', rewardsRow);
        }

        // Settings — upsert when lastDurationByTagId / lastSelectedTagId change in main store
        if (changes.settings) {
          const currentPrefs = useUnifiedStore.getState().preferences;
          const row = settingsToRow(currentPrefs, userId, state.focus);
          await SyncService.enqueue('user_settings', 'upsert', row);
        }

        // Blocklist — push current blob to cloud (push-only, not full merge)
        if (changes.blocklist) {
          const selectionId = state.blocklist.currentSelectionId;
          if (selectionId) {
            await BlocklistSyncService.push(userId, selectionId);
          }
        }

        // Update snapshot
        lastSyncedSnapshot = takeSnapshot(state);

        // Attempt to flush immediately
        await SyncService.flush();

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
    pendingChanges = { sessions: false, tags: false, goals: false, todos: false, badges: false, coachReports: false, rewards: false, purchases: false, customRewards: false, blocklist: false, settings: false };
    lastSyncedSnapshot = null;
    lastSyncedSettings = null;
  };
}

function takeSnapshot(state: any) {
  return {
    sessions: { ...state.focus.sessions.byId },
    tags: { ...state.focus.tags.byId },
    goals: { ...state.focus.goals.byId },
    todos: { ...(state.focus.todos?.byId ?? {}) },
    badges: { ...(state.focus.badges?.byId ?? {}) },
    coachReports: { ...(state.focus.coachReports?.byId ?? {}) },
    purchases: { ...(state.rewards.purchases?.byId ?? {}) },
    customRewards: { ...(state.rewards.customRewards?.byId ?? {}) },
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
      await beforeUpsert?.(newById[id]);
      await SyncService.enqueue(table, 'upsert', row);
      upsertCount++;
    }
  }

  // Deleted items (present in old, missing in new)
  for (const id of Object.keys(oldById)) {
    if (!newById[id]) {
      // Never derive a focus_sessions soft_delete from the diff. Every legitimate
      // session deletion already pushes its own soft_delete (enqueueSessionDeleteNow
      // in deleteSession), so a session missing here means a store APPLY dropped it —
      // e.g. a cold-start merge built from a local snapshot captured before the user
      // created the session. Turning that into a cloud soft_delete permanently
      // destroyed just-created sessions (deleted_at set, filtered from every future
      // pull). Log loudly instead so the racing apply is visible in diagnostics.
      if (table === 'focus_sessions') {
        console.error(
          `[SyncMW] ⚠️ Session ${id} vanished from the store without deleteSession — ` +
            'a stale apply removed it; NOT propagating a cloud soft_delete'
        );
        AnalyticsTracker.track('sync_session_vanished', { session_id: id });
        continue;
      }
      await SyncService.enqueue(table, 'soft_delete', { id });
      deleteCount++;
    }
  }
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
  pendingChanges = { sessions: false, tags: false, goals: false, todos: false, badges: false, coachReports: false, rewards: false, purchases: false, customRewards: false, blocklist: false, settings: false };

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
