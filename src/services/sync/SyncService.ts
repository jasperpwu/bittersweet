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
  rewardsToRow,
  rowToRewards,
  badgeToRow,
  rowToBadge,
  settingsToRow,
  rowToSettings,
  referralToRow,
  rowToReferral,
  normalizedToRows,
  rowsToNormalized,
} from './SyncMapper';

const BATCH_SIZE = 100;

const FLUSH_PRIORITY: Record<string, number> = {
  session_tags: 10,
  focus_goals: 20,
  focus_sessions: 30,
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

    // Upload settings (from unified store preferences + main store lastDurationByTagId)
    if (localState.settings) {
      const settingsRow = settingsToRow(localState.settings, userId, localState.focus?.lastDurationByTagId);
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
   * Pull all user data from Supabase and return as store-shaped snapshot.
   */
  static async pullAll(userId: string): Promise<any> {
    console.log('☁️ Pulling all data from cloud...');

    const [sessionsRes, tagsRes, goalsRes, rewardsRes, badgesRes, settingsRes, referralRes] =
      await Promise.all([
        supabase
          .from('focus_sessions')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('session_tags')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase
          .from('focus_goals')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase.from('rewards').select('*').eq('user_id', userId).single(),
        supabase
          .from('badges')
          .select('*')
          .eq('user_id', userId)
          .is('deleted_at', null),
        supabase.from('user_settings').select('*').eq('user_id', userId).single(),
        supabase.from('referral_tracking').select('*').eq('user_id', userId).maybeSingle(),
      ]);

    const sessions = rowsToNormalized(
      sessionsRes.data ?? [],
      rowToSession
    );
    const tags = rowsToNormalized(tagsRes.data ?? [], rowToTag);
    tags.allIds.sort((a, b) => (tags.byId[a]?.sortOrder ?? 0) - (tags.byId[b]?.sortOrder ?? 0));
    const goals = rowsToNormalized(goalsRes.data ?? [], rowToGoal);
    goals.allIds.sort((a, b) => (goals.byId[a]?.sortOrder ?? 0) - (goals.byId[b]?.sortOrder ?? 0));
    const badges = rowsToNormalized(badgesRes.data ?? [], rowToBadge);
    const rewards = rewardsRes.data
      ? rowToRewards(rewardsRes.data)
      : { balance: 0, totalEarned: 0, totalSpent: 0 };
    const settings = settingsRes.data
      ? rowToSettings(settingsRes.data)
      : null;
    const referral = referralRes.data
      ? rowToReferral(referralRes.data)
      : { referralCode: null, referralCount: 0, claimedTier: 0 };

    // Pull blocklist blob
    let blocklistBlob: string | null = null;
    try {
      blocklistBlob = await BlocklistSyncService.pull(userId);
    } catch (error) {
      console.error('Failed to pull blocklist:', error);
    }

    console.log(
      `☁️ Pulled: ${sessions.allIds.length} sessions, ${tags.allIds.length} tags, ${goals.allIds.length} goals, ${badges.allIds.length} badges, settings: ${settings ? 'yes' : 'no'}, blocklist: ${blocklistBlob ? 'yes' : 'no'}`
    );

    return {
      focus: { sessions, tags, goals, badges },
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
        badges: SyncService.mergeNormalized(
          local.focus.badges ?? { byId: {}, allIds: [] },
          remote.focus.badges ?? { byId: {}, allIds: [] },
          'updatedAt'
        ),
      },
      rewards: {
        // Last-write-wins: whichever side has the later updatedAt wins aggregate fields
        ...(
          new Date(local.rewards?.updatedAt ?? 0).getTime() >=
          new Date(remote.rewards?.updatedAt ?? 0).getTime()
            ? { balance: local.rewards.balance, totalEarned: local.rewards.totalEarned, totalSpent: local.rewards.totalSpent, updatedAt: local.rewards.updatedAt }
            : { balance: remote.rewards.balance, totalEarned: remote.rewards.totalEarned, totalSpent: remote.rewards.totalSpent, updatedAt: remote.rewards.updatedAt }
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

  /**
   * Flush the offline queue to Supabase.
   */
  static async flush(): Promise<{ flushed: number; failed: number }> {
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

    for (const entry of entries) {
      try {
        console.log(`[SyncFlush] Processing ${entry.id}: ${entry.operation} → ${entry.table} (record: ${entry.data?.id || entry.data?.user_id || '?'})`);
        if (entry.operation === 'upsert') {
          // rewards and user_settings tables use user_id as primary key, not id
          const conflictCol = (entry.table === 'rewards' || entry.table === 'user_settings') ? 'user_id' : 'id';
          const { error } = await supabase
            .from(entry.table)
            .upsert(entry.data, { onConflict: conflictCol });
          if (error) throw error;
          console.log(`[SyncFlush] ✓ ${entry.table} upsert succeeded for ${entry.data?.id || entry.data?.user_id}`);
        } else if (entry.operation === 'soft_delete') {
          const { error } = await supabase
            .from(entry.table)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', entry.data.id);
          if (error) throw error;
          console.log(`[SyncFlush] ✓ ${entry.table} soft_delete succeeded for ${entry.data.id}`);
        }
        succeeded.push(entry.id);
      } catch (error: any) {
        console.error(`[SyncFlush] ✗ FAILED entry ${entry.id} (${entry.table} ${entry.operation}):`, error?.message || error, JSON.stringify(error));
        if (entry.table === 'focus_sessions') {
          console.error(
            `[SyncFlush] Failed focus session payload: id=${entry.data?.id ?? '?'} user_id=${entry.data?.user_id ?? '?'} tag_id=${entry.data?.tag_id ?? '?'}`
          );
        }

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
          quarantined.push(entry.id);
          continue;
        }

        failed++;
      }
    }

    await syncQueue.remove([...succeeded, ...quarantined]);
    console.log(
      `☁️ Flush complete: ${succeeded.length} succeeded, ${failed} failed` +
        (quarantined.length ? `, ${quarantined.length} quarantined` : '')
    );

    return { flushed: succeeded.length, failed };
  }

  // --- Private helpers ---

  private static async batchUpsert(
    table: string,
    rows: Record<string, any>[]
  ): Promise<void> {
    const conflictCol = (table === 'rewards' || table === 'user_settings') ? 'user_id' : 'id';
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
