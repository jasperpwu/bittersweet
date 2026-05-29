import { supabase } from '../../config/supabase';
import { syncQueue, type SyncQueueEntry } from './SyncQueue';
import {
  sessionToRow,
  rowToSession,
  tagToRow,
  rowToTag,
  goalToRow,
  rowToGoal,
  rewardsToRow,
  rowToRewards,
  rewardTransactionToRow,
  rowToRewardTransaction,
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

    // Upload reward transactions
    if (localState.rewards.transactions?.length > 0) {
      const txRows = localState.rewards.transactions.map((tx: any) =>
        rewardTransactionToRow(tx, userId)
      );
      await SyncService.batchUpsert('reward_transactions', txRows);
    }

    console.log('☁️ Initial upload complete');
  }

  /**
   * Pull all user data from Supabase and return as store-shaped snapshot.
   */
  static async pullAll(userId: string): Promise<any> {
    console.log('☁️ Pulling all data from cloud...');

    const [sessionsRes, tagsRes, goalsRes, rewardsRes, txRes] =
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
          .from('reward_transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
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
    const transactions = (txRes.data ?? []).map(rowToRewardTransaction);

    console.log(
      `☁️ Pulled: ${sessions.allIds.length} sessions, ${tags.allIds.length} tags, ${goals.allIds.length} goals`
    );

    return {
      focus: { sessions, tags, goals },
      rewards: { ...rewards, transactions },
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
        transactions: SyncService.mergeTransactions(
          local.rewards?.transactions ?? [],
          remote.rewards?.transactions ?? []
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
        if (entry.operation === 'upsert') {
          // rewards table uses user_id as primary key, not id
          const conflictCol = entry.table === 'rewards' ? 'user_id' : 'id';
          const { error } = await supabase
            .from(entry.table)
            .upsert(entry.data, { onConflict: conflictCol });
          if (error) throw error;
        } else if (entry.operation === 'soft_delete') {
          const { error } = await supabase
            .from(entry.table)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', entry.data.id);
          if (error) throw error;
        }
        succeeded.push(entry.id);
      } catch (error) {
        console.error(`Failed to flush entry ${entry.id}:`, error);
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

  private static mergeTransactions(
    local: any[],
    remote: any[]
  ): any[] {
    const seen = new Set<string>();
    const merged: any[] = [];

    // Union by ID
    for (const tx of [...remote, ...local]) {
      if (!seen.has(tx.id)) {
        seen.add(tx.id);
        merged.push(tx);
      }
    }

    // Sort by timestamp
    merged.sort((a, b) => {
      const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return aTime - bTime;
    });

    return merged;
  }
}
