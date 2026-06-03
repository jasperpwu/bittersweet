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
  normalizedToRows,
  rowsToNormalized,
} from './SyncMapper';

const BATCH_SIZE = 100;

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

    const [sessionsRes, tagsRes, goalsRes, rewardsRes] =
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
      ]);

    const sessions = rowsToNormalized(
      sessionsRes.data ?? [],
      rowToSession
    );
    const tags = rowsToNormalized(tagsRes.data ?? [], rowToTag);
    const goals = rowsToNormalized(goalsRes.data ?? [], rowToGoal);
    const rewards = rewardsRes.data
      ? rowToRewards(rewardsRes.data)
      : { balance: 0, totalEarned: 0, totalSpent: 0 };

    // Pull blocklist blob
    let blocklistBlob: string | null = null;
    try {
      blocklistBlob = await BlocklistSyncService.pull(userId);
    } catch (error) {
      console.error('Failed to pull blocklist:', error);
    }

    console.log(
      `☁️ Pulled: ${sessions.allIds.length} sessions, ${tags.allIds.length} tags, ${goals.allIds.length} goals, blocklist: ${blocklistBlob ? 'yes' : 'no'}`
    );

    return {
      focus: { sessions, tags, goals },
      rewards,
      blocklistBlob,
    };
  }

  /**
   * Merge local and remote state using last-write-wins on updatedAt.
   * Returns a merged snapshot to apply to the store.
   */
  static merge(local: any, remote: any): any {
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
          'updatedAt'
        ),
        goals: SyncService.mergeNormalized(
          local.focus.goals,
          remote.focus.goals,
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
    await syncQueue.load();
    if (syncQueue.size === 0) return { flushed: 0, failed: 0 };

    console.log(`☁️ Flushing ${syncQueue.size} queued operations...`);

    const entries = await syncQueue.dequeue(50);
    const succeeded: string[] = [];
    let failed = 0;

    for (const entry of entries) {
      try {
        console.log(`[SyncFlush] Processing ${entry.id}: ${entry.operation} → ${entry.table} (record: ${entry.data?.id || entry.data?.user_id || '?'})`);
        if (entry.operation === 'upsert') {
          // rewards table uses user_id as primary key, not id
          const conflictCol = entry.table === 'rewards' ? 'user_id' : 'id';
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
        failed++;
      }
    }

    await syncQueue.remove(succeeded);
    console.log(
      `☁️ Flush complete: ${succeeded.length} succeeded, ${failed} failed`
    );

    return { flushed: succeeded.length, failed };
  }

  // --- Private helpers ---

  private static async batchUpsert(
    table: string,
    rows: Record<string, any>[]
  ): Promise<void> {
    const conflictCol = table === 'rewards' ? 'user_id' : 'id';
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
    dateField: string
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

    return {
      byId: merged,
      allIds: Object.keys(merged),
    };
  }

}
