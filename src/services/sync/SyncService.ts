import { supabase } from '../../config/supabase';
import { syncQueue, type SyncQueueEntry } from './SyncQueue';
import { BlocklistSyncService } from './BlocklistSyncService';
import {
  sessionToRow,
  rowToSession,
  tagToRow,
  rowToTag,
  goalToRow,
  rowToGoal,
  todoToRow,
  rowToTodo,
  rewardsToRow,
  rowToRewards,
  badgeToRow,
  rowToBadge,
  coachReportToRow,
  rowToCoachReport,
  purchaseToRow,
  rowToPurchase,
  customRewardToRow,
  rowToCustomReward,
  settingsToRow,
  rowToSettings,
  referralToRow,
  rowToReferral,
  normalizedToRows,
  rowsToNormalized,
  defaultSetupTasks,
  mergeSetupTasks,
} from './SyncMapper';
import { AnalyticsTracker } from '../analytics';

const BATCH_SIZE = 100;

const FLUSH_PRIORITY: Record<string, number> = {
  session_tags: 10,
  focus_goals: 20,
  todos: 25,
  focus_sessions: 30,
  coach_reports: 40,
};

function sortEntriesForFlush(entries: SyncQueueEntry[]): SyncQueueEntry[] {
  return [...entries].sort((a, b) => {
    const aPriority = a.operation === 'upsert'
      ? FLUSH_PRIORITY[a.table] ?? 50
      : 100;
    const bPriority = b.operation === 'upsert'
      ? FLUSH_PRIORITY[b.table] ?? 50
      : 100;

    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.timestamp - b.timestamp;
  });
}

export class SyncService {
  /**
   * Upload all local data on first sign-in (when cloud has no data).
   * Chunks inserts to avoid Supabase payload limits.
   */
  static async initialUpload(
    localState: any,
    userId: string
  ): Promise<void> {
    console.log('☁️ Starting initial upload...');

    // Upload tags
    const tagRows = normalizedToRows(localState.focus.tags, tagToRow, userId);
    await SyncService.batchUpsert('session_tags', tagRows);

    // Upload sessions
    const sessionRows = normalizedToRows(
      localState.focus.sessions,
      sessionToRow,
      userId
    );
    await SyncService.batchUpsert('focus_sessions', sessionRows);

    // Upload goals
    const goalRows = normalizedToRows(localState.focus.goals, goalToRow, userId);
    await SyncService.batchUpsert('focus_goals', goalRows);

    // Upload todos
    if (localState.focus.todos?.allIds?.length > 0) {
      const todoRows = normalizedToRows(localState.focus.todos, todoToRow, userId);
      await SyncService.batchUpsert('todos', todoRows);
    }

    // Upload rewards
    const rewardsRow = rewardsToRow(localState.rewards, userId);
    const { error: rewardsError } = await supabase
      .from('rewards')
      .upsert(rewardsRow, { onConflict: 'user_id' });
    if (rewardsError) {
      console.error('Failed to upload rewards:', rewardsError);
    }

    // Upload badges
    if (localState.focus.badges?.allIds?.length > 0) {
      const badgeRows = normalizedToRows(localState.focus.badges, badgeToRow, userId);
      await SyncService.batchUpsert('badges', badgeRows);
    }

    // Upload coach reports
    if (localState.focus.coachReports?.allIds?.length > 0) {
      const coachRows = normalizedToRows(localState.focus.coachReports, coachReportToRow, userId);
      await SyncService.batchUpsert('coach_reports', coachRows);
    }

    // Upload purchase history
    if (localState.rewards?.purchases?.allIds?.length > 0) {
      const purchaseRows = normalizedToRows(localState.rewards.purchases, purchaseToRow, userId);
      await SyncService.batchUpsert('purchases', purchaseRows);
    }

    // Upload custom rewards (fruit-store Custom tab definitions)
    if (localState.rewards?.customRewards?.allIds?.length > 0) {
      const customRewardRows = normalizedToRows(
        localState.rewards.customRewards,
        customRewardToRow,
        userId
      );
      await SyncService.batchUpsert('custom_rewards', customRewardRows);
    }

    // Upload settings (from unified store preferences + main store focus fields)
    if (localState.settings) {
      const settingsRow = settingsToRow(localState.settings, userId, localState.focus);
      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert(settingsRow, { onConflict: 'user_id' });
      if (settingsError) {
        console.error('Failed to upload settings:', settingsError);
      }
    }

    // Upload referral tracking
    if (localState.referral?.referralCode || localState.referral?.referralCount > 0) {
      const referralRow = referralToRow(localState.referral, userId);
      const { error: referralError } = await supabase
        .from('referral_tracking')
        .upsert(referralRow, { onConflict: 'user_id' });
      if (referralError) {
        console.error('Failed to upload referral tracking:', referralError);
      }
    }

    // Upload blocklist selection
    const blocklistSelectionId = localState.blocklist?.currentSelectionId;
    if (blocklistSelectionId) {
      try {
        await BlocklistSyncService.push(userId, blocklistSelectionId);
      } catch (error) {
        console.error('Failed to upload blocklist:', error);
      }
    }

    console.log('☁️ Initial upload complete');
  }

  /**
   * Cheap "does this account have any cloud data?" probe — the emptiness test that
   * decides brand-new-signup vs. existing-account on SIGNED_IN, and merge vs. upload on
   * INITIAL_SESSION. It answers a single boolean, so it must NOT be a full pullAll: that
   * downloaded every session/badge/purchase just to read `.length > 0`, then threw it all
   * away and pulled the identical payload again via pullAndApply/triggerSync.
   *
   * The filters mirror pullAll exactly so the verdict is identical: sessions exclude
   * soft-deletes, tags include them (pullAll deliberately keeps tag tombstones).
   *
   * Returns null on error — callers must treat that as "unknown" and take the branch that
   * preserves local data, never the branch that wipes it.
   */
  static async probeHasData(userId: string): Promise<boolean | null> {
    try {
      const [sessionsRes, tagsRes] = await Promise.all([
        supabase
          .from('focus_sessions')
          .select('id')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .limit(1),
        supabase.from('session_tags').select('id').eq('user_id', userId).limit(1),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      if (tagsRes.error) throw tagsRes.error;
      const hasData =
        (sessionsRes.data?.length ?? 0) > 0 || (tagsRes.data?.length ?? 0) > 0;
      console.log(`☁️ Cloud probe: ${hasData ? 'has data' : 'empty'}`);
      return hasData;
    } catch (error) {
      console.error('☁️ Cloud probe failed:', error);
      return null;
    }
  }

  /**
   * Pull all user data from Supabase and return as store-shaped snapshot.
   */
  static async pullAll(userId: string): Promise<any> {
    console.log('☁️ Pulling all data from cloud...');

    // The blocklist blob rides in the SAME Promise.all as the table queries. It used to
    // be awaited afterwards, which cost a full extra round trip on every pull for no
    // reason — it has no dependency on the rows above. `.catch()` keeps a blocklist
    // failure from rejecting the whole batch (it was previously in its own try/catch).
    const [sessionsRes, tagsRes, goalsRes, todosRes, rewardsRes, badgesRes, coachRes, purchasesRes, customRewardsRes, settingsRes, referralRes, blocklistBlob] =
      await Promise.all([
        supabase
          .from('focus_sessions')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        // Pull soft-deleted tags too: live historical sessions still reference
        // deleted tags (tag_id FK), and deleteTag keeps tombstones in byId. All
        // tag pickers/lists filter !deletedAt, so deleted tags never leak into a
        // selector — but session history can still resolve their label, and the
        // sync guard stops warning about "missing local tag".
        supabase
          .from('session_tags')
          .select('*')
          .eq('user_id', userId),
        supabase
          .from('focus_goals')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('todos')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase.from('rewards').select('*').eq('user_id', userId).single(),
        supabase
          .from('badges')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('coach_reports')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('purchases')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('custom_rewards')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase.from('user_settings').select('*').eq('user_id', userId).single(),
        supabase.from('referral_tracking').select('*').eq('user_id', userId).maybeSingle(),
        BlocklistSyncService.pull(userId).catch((error) => {
          console.error('Failed to pull blocklist:', error);
          return null;
        }),
      ]);

    const sessions = rowsToNormalized(
      sessionsRes.data ?? [],
      rowToSession
    );
    const tags = rowsToNormalized(tagsRes.data ?? [], rowToTag);
    tags.allIds.sort((a, b) => (tags.byId[a]?.sortOrder ?? 0) - (tags.byId[b]?.sortOrder ?? 0));
    const goals = rowsToNormalized(goalsRes.data ?? [], rowToGoal);
    goals.allIds.sort((a, b) => (goals.byId[a]?.sortOrder ?? 0) - (goals.byId[b]?.sortOrder ?? 0));
    const todos = rowsToNormalized(todosRes.data ?? [], rowToTodo);
    todos.allIds.sort((a, b) => (todos.byId[a]?.sortOrder ?? 0) - (todos.byId[b]?.sortOrder ?? 0));
    const badges = rowsToNormalized(badgesRes.data ?? [], rowToBadge);
    const coachReports = rowsToNormalized(coachRes.data ?? [], rowToCoachReport);
    const rewards = rewardsRes.data
      ? rowToRewards(rewardsRes.data)
      : { balance: 0, totalEarned: 0, totalSpent: 0, tasks: defaultSetupTasks(), unlockHistory: {} };
    // Purchase history rides on the rewards blob so merge/apply stay rewards-shaped.
    rewards.purchases = rowsToNormalized(purchasesRes.data ?? [], rowToPurchase);
    // Custom reward definitions ride along the same way.
    rewards.customRewards = rowsToNormalized(customRewardsRes.data ?? [], rowToCustomReward);
    const settings = settingsRes.data
      ? rowToSettings(settingsRes.data)
      : null;
    const referral = referralRes.data
      ? rowToReferral(referralRes.data)
      : { referralCode: null, referralCount: 0, claimedTier: 0 };

    console.log(
      `☁️ Pulled: ${sessions.allIds.length} sessions, ${tags.allIds.length} tags, ${goals.allIds.length} goals, ${badges.allIds.length} badges, settings: ${settings ? 'yes' : 'no'}, blocklist: ${blocklistBlob ? 'yes' : 'no'}`
    );

    return {
      focus: { sessions, tags, goals, todos, badges, coachReports },
      rewards,
      settings,
      referral,
      blocklistBlob,
    };
  }

  /**
   * Merge local and remote state using last-write-wins on updatedAt.
   * Returns a merged snapshot to apply to the store.
   */
  static merge(local: any, remote: any): any {
    // Settings: object/value pattern — compare updatedAt, latest wins
    let mergedSettings = null;
    if (local.settings || remote.settings) {
      const localTime = new Date(local.settings?.updatedAt ?? 0).getTime();
      const remoteTime = new Date(remote.settings?.updatedAt ?? 0).getTime();
      mergedSettings = remoteTime > localTime ? remote.settings : local.settings;
      if (mergedSettings) {
        mergedSettings = {
          ...mergedSettings,
          lastDurationByTagId: {
            ...(remote.settings?.lastDurationByTagId ?? {}),
            ...(local.settings?.lastDurationByTagId ?? {}),
          },
          // Last-used tag: prefer this device's choice (it reflects the most recent
          // real usage), fall back to the cloud when local has none — the reinstall
          // case, where the whole point is to restore the tag instead of showing
          // "Select a tag". Same local-biased rule as lastDurationByTagId above.
          lastSelectedTagId:
            local.settings?.lastSelectedTagId ?? remote.settings?.lastSelectedTagId ?? null,
        };
      }
    }

    return {
      focus: {
        sessions: SyncService.mergeNormalized(
          local.focus.sessions,
          remote.focus.sessions,
          'updatedAt'
        ),
        tags: SyncService.mergeNormalized(
          local.focus.tags,
          remote.focus.tags,
          'updatedAt',
          'sortOrder'
        ),
        goals: SyncService.mergeNormalized(
          local.focus.goals,
          remote.focus.goals,
          'updatedAt',
          'sortOrder'
        ),
        todos: SyncService.mergeNormalized(
          local.focus.todos ?? { byId: {}, allIds: [] },
          remote.focus.todos ?? { byId: {}, allIds: [] },
          'updatedAt',
          'sortOrder'
        ),
        badges: SyncService.mergeNormalized(
          local.focus.badges ?? { byId: {}, allIds: [] },
          remote.focus.badges ?? { byId: {}, allIds: [] },
          'updatedAt'
        ),
        coachReports: SyncService.mergeNormalized(
          local.focus.coachReports ?? { byId: {}, allIds: [] },
          remote.focus.coachReports ?? { byId: {}, allIds: [] },
          'updatedAt'
        ),
      },
      rewards: {
        // Last-write-wins: whichever side has the later updatedAt wins aggregate fields
        ...(
          new Date(local.rewards?.updatedAt ?? 0).getTime() >=
          new Date(remote.rewards?.updatedAt ?? 0).getTime()
            ? { balance: local.rewards.balance, totalEarned: local.rewards.totalEarned, totalSpent: local.rewards.totalSpent, unlockHistory: local.rewards.unlockHistory ?? {}, updatedAt: local.rewards.updatedAt }
            : { balance: remote.rewards.balance, totalEarned: remote.rewards.totalEarned, totalSpent: remote.rewards.totalSpent, unlockHistory: remote.rewards.unlockHistory ?? {}, updatedAt: remote.rewards.updatedAt }
        ),
        // Setup tasks are monotonic — OR-merge so a claim/setup on either side is never
        // lost to LWW (e.g. local just detected widget setup while remote already claimed).
        tasks: mergeSetupTasks(local.rewards?.tasks, remote.rewards?.tasks),
        // Purchase history is a list — per-row LWW like badges. Rows are mostly
        // write-once (union of local-only and remote-only purchases), except
        // photoUrl edits, which LWW resolves via updatedAt.
        purchases: SyncService.mergeNormalized(
          local.rewards?.purchases ?? { byId: {}, allIds: [] },
          remote.rewards?.purchases ?? { byId: {}, allIds: [] },
          'updatedAt'
        ),
        // Custom reward definitions — same per-row LWW list pattern.
        customRewards: SyncService.mergeNormalized(
          local.rewards?.customRewards ?? { byId: {}, allIds: [] },
          remote.rewards?.customRewards ?? { byId: {}, allIds: [] },
          'updatedAt'
        ),
      },
      settings: mergedSettings,
    };
  }

  /**
   * Enqueue an operation to the offline sync queue.
   */
  static async enqueue(
    table: string,
    operation: 'upsert' | 'soft_delete',
    data: Record<string, any>
  ): Promise<void> {
    await syncQueue.enqueue({ table, operation, data });
  }

  // Single-flight guard. Nine call sites can invoke flush() (both debounces, foreground
  // reconcile, sign-out, cold-start…). Because dequeue() only READS the queue (rows leave
  // only via remove()), two overlapping flushes would grab the SAME rows and fire duplicate
  // upserts at once — saturating iOS's small per-host connection pool, which itself stalls
  // sockets into "Network request failed". We serialize: while a flush runs, later callers
  // await the in-flight promise; a `rerun` flag guarantees exactly one more pass afterward so
  // rows enqueued during the current flush still go out (and awaiters see them flushed).
  private static inFlight: Promise<{ flushed: number; failed: number }> | null = null;
  private static rerun = false;

  /**
   * Flush the offline queue to Supabase. Concurrency-safe: concurrent calls coalesce onto a
   * single in-flight run (plus at most one trailing pass to cover late enqueues).
   */
  static flush(): Promise<{ flushed: number; failed: number }> {
    if (SyncService.inFlight) {
      SyncService.rerun = true;
      return SyncService.inFlight;
    }

    SyncService.inFlight = (async () => {
      try {
        let result = await SyncService.flushOnce();
        while (SyncService.rerun) {
          SyncService.rerun = false;
          const next = await SyncService.flushOnce();
          result = {
            flushed: result.flushed + next.flushed,
            failed: next.failed,
          };
        }
        return result;
      } finally {
        SyncService.inFlight = null;
        SyncService.rerun = false;
      }
    })();

    return SyncService.inFlight;
  }

  // rewards and user_settings tables use user_id as primary key, not id; coach_reports has a
  // composite (user_id, id) PK because report ids are deterministic per week and shared
  // across users (see migration). Everything else conflicts on `id`.
  private static conflictColFor(table: string): string {
    if (table === 'rewards' || table === 'user_settings') return 'user_id';
    if (table === 'coach_reports') return 'user_id,id';
    return 'id';
  }

  private static async flushOnce(): Promise<{ flushed: number; failed: number }> {
    // Never flush without a valid auth session. Every syncable table's RLS policy is
    // WITH CHECK (auth.uid() = user_id), so flushing post-sign-out (or mid-token-loss)
    // fails every row. A debounced flush scheduled while authenticated can fire after
    // the token is already gone — this guard stops that error storm at the source.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.log('☁️ Skipping flush — no authenticated session');
      return { flushed: 0, failed: 0 };
    }

    await syncQueue.load();
    if (syncQueue.size === 0) return { flushed: 0, failed: 0 };

    console.log(`☁️ Flushing ${syncQueue.size} queued operations...`);

    const entries = sortEntriesForFlush(await syncQueue.dequeue(syncQueue.size));
    const succeeded: string[] = [];
    // Entries we intentionally give up on (non-retryable) so they stop replaying
    // every flush. Removed from the queue alongside `succeeded`, but not counted
    // as failures since there's nothing to retry.
    const quarantined: string[] = [];
    let failed = 0;

    // Group into contiguous same-(table, operation) runs. `entries` is already sorted by
    // FLUSH_PRIORITY (tags before sessions for the FK, soft_deletes last), so grouping runs
    // preserves that order — we just collapse each run into one batched request instead of
    // one request per row.
    const groups: { table: string; operation: SyncQueueEntry['operation']; items: SyncQueueEntry[] }[] = [];
    for (const entry of entries) {
      const last = groups[groups.length - 1];
      if (last && last.table === entry.table && last.operation === entry.operation) {
        last.items.push(entry);
      } else {
        groups.push({ table: entry.table, operation: entry.operation, items: [entry] });
      }
    }

    for (const group of groups) {
      for (let i = 0; i < group.items.length; i += BATCH_SIZE) {
        const chunk = group.items.slice(i, i + BATCH_SIZE);
        const batchError = await SyncService.flushBatch(group.table, group.operation, chunk);

        if (!batchError) {
          for (const entry of chunk) succeeded.push(entry.id);
          continue;
        }

        // Batch failed as a whole — fall back to per-entry so one poison row can't strand
        // the rest of the chunk, and so per-entry telemetry + quarantine still apply.
        for (const entry of chunk) {
          const outcome = await SyncService.flushEntry(entry);
          if (outcome === 'ok') succeeded.push(entry.id);
          else if (outcome === 'quarantine') quarantined.push(entry.id);
          else failed++;
        }
      }
    }

    await syncQueue.remove([...succeeded, ...quarantined]);
    console.log(
      `☁️ Flush complete: ${succeeded.length} succeeded, ${failed} failed` +
        (quarantined.length ? `, ${quarantined.length} quarantined` : '')
    );

    return { flushed: succeeded.length, failed };
  }

  /**
   * Attempt one batched request for a same-(table, operation) chunk. Returns the error on
   * failure (caller falls back to per-entry) or null on success.
   */
  private static async flushBatch(
    table: string,
    operation: SyncQueueEntry['operation'],
    chunk: SyncQueueEntry[]
  ): Promise<any> {
    try {
      if (operation === 'upsert') {
        const { error } = await supabase
          .from(table)
          .upsert(chunk.map((e) => e.data), { onConflict: SyncService.conflictColFor(table) });
        if (error) throw error;
      } else if (operation === 'soft_delete') {
        const ids = chunk.map((e) => e.data.id);
        const { error } = await supabase
          .from(table)
          .update({ deleted_at: new Date().toISOString() })
          .in('id', ids);
        if (error) throw error;
      }
      return null;
    } catch (error: any) {
      return error ?? new Error('unknown batch error');
    }
  }

  /**
   * Flush a single queue entry. Used as the per-entry fallback when a batch fails, preserving
   * the original telemetry + quarantine behavior. Returns 'ok' | 'quarantine' | 'fail'.
   */
  private static async flushEntry(
    entry: SyncQueueEntry
  ): Promise<'ok' | 'quarantine' | 'fail'> {
    try {
      if (entry.operation === 'upsert') {
        const { error } = await supabase
          .from(entry.table)
          .upsert(entry.data, { onConflict: SyncService.conflictColFor(entry.table) });
        if (error) throw error;
      } else if (entry.operation === 'soft_delete') {
        const { error } = await supabase
          .from(entry.table)
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', entry.data.id);
        if (error) throw error;
      }
      return 'ok';
    } catch (error: any) {
      console.error(`[SyncFlush] ✗ FAILED entry ${entry.id} (${entry.table} ${entry.operation}):`, error?.message || error, JSON.stringify(error));
      if (entry.table === 'focus_sessions') {
        console.error(
          `[SyncFlush] Failed focus session payload: id=${entry.data?.id ?? '?'} user_id=${entry.data?.user_id ?? '?'} tag_id=${entry.data?.tag_id ?? '?'}`
        );
      }

      // Telemetry so a persistently-stuck ("poison") queue entry is visible in
      // PostHog — this is the class that silently strands a session until a
      // reinstall wipes it. Fires per failed entry per flush; a stuck row that
      // keeps failing across flushes is exactly the signal we want to surface.
      AnalyticsTracker.track('sync_flush_entry_failed', {
        table: entry.table,
        operation: entry.operation,
        code: error?.code ?? null,
        message: error?.message ?? String(error),
      });

      // Quarantine the one known non-retryable case: a HealthKit-imported
      // session (`hk-` id, derived from the global Apple Health workout UUID)
      // whose cloud row is owned by a different account that previously
      // imported the same physical workout on this device. The PK collides on
      // `id`, so the upsert takes the UPDATE path and Postgres rejects it with
      // 42501 (RLS USING: auth.uid() != the existing row's user_id). Local
      // wipes can't remove another account's cloud row, so this would retry
      // forever. Drop it — the import already exists locally and stays.
      const id = entry.data?.id;
      if (
        entry.operation === 'upsert' &&
        entry.table === 'focus_sessions' &&
        typeof id === 'string' &&
        id.startsWith('hk-') &&
        error?.code === '42501'
      ) {
        console.warn(
          `[SyncFlush] Quarantining cross-account HealthKit session ${id} (owned by another account in cloud) — dropping from queue`
        );
        return 'quarantine';
      }

      return 'fail';
    }
  }

  // --- Private helpers ---

  private static async batchUpsert(
    table: string,
    rows: Record<string, any>[]
  ): Promise<void> {
    const conflictCol = (table === 'rewards' || table === 'user_settings')
      ? 'user_id'
      : table === 'coach_reports'
        ? 'user_id,id'
        : 'id';
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict: conflictCol });
      if (error) {
        console.error(`Batch upsert error for ${table}:`, error);
      }
    }
  }

  private static mergeNormalized(
    local: { byId: Record<string, any>; allIds: string[] },
    remote: { byId: Record<string, any>; allIds: string[] },
    dateField: string,
    sortField?: string
  ): { byId: Record<string, any>; allIds: string[] } {
    const merged: Record<string, any> = {};

    // Start with all remote items
    for (const id of remote.allIds) {
      merged[id] = remote.byId[id];
    }

    // Overlay local items using last-write-wins
    for (const id of local.allIds) {
      const localItem = local.byId[id];
      const remoteItem = merged[id];

      if (!remoteItem) {
        // Only in local — keep it
        merged[id] = localItem;
      } else {
        // Both exist — compare timestamps
        const localTime = localItem[dateField] instanceof Date
          ? localItem[dateField].getTime()
          : new Date(localItem[dateField] ?? 0).getTime();
        const remoteTime = remoteItem[dateField] instanceof Date
          ? remoteItem[dateField].getTime()
          : new Date(remoteItem[dateField] ?? 0).getTime();

        merged[id] = localTime >= remoteTime ? localItem : remoteItem;
      }
    }

    let allIds = Object.keys(merged);
    if (sortField) {
      allIds.sort((a, b) => (merged[a][sortField] ?? 0) - (merged[b][sortField] ?? 0));
    }

    return {
      byId: merged,
      allIds,
    };
  }

}
