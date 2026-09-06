import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWeekStart } from '../grove/GroveRankingService';
import {
  union,
  difference,
  getFamilyActivitySelectionId,
  setFamilyActivitySelectionId,
  blockSelection,
  unblockSelection,
  activitySelectionMetadata,
} from 'react-native-device-activity';

const LAST_SYNCED_BLOB_KEY = 'blocklist-last-synced-blob';
// Single canonical selection ID — used by the picker, blocking, and sync.
// All paths write to this ID so there is only one source of truth in UserDefaults.
const CANONICAL_SELECTION_ID = 'bittersweet-blocklist';

// Temporary named IDs for set operations (stored in UserDefaults)
const TEMP_SERVER_ID = '_sync-temp-server';
const TEMP_BASELINE_ID = '_sync-temp-baseline';
const TEMP_ADDED_ID = '_sync-temp-added';
const TEMP_REMOVED_ID = '_sync-temp-removed';
const TEMP_SERVER_PLUS_ADDED_ID = '_sync-temp-server-plus-added';

export interface BlocklistEditHistory {
  weekStart: string; // ISO week start (Monday 00:00 local) the count belongs to
  editsThisWeek: number;
}

export class BlocklistSyncService {
  /**
   * Push the blob for a named local selection ID to Supabase.
   * Reads the raw blob from UserDefaults via the named ID.
   */
  static async push(userId: string, selectionId: string): Promise<void> {
    const blob = getFamilyActivitySelectionId(selectionId);

    const { error } = await supabase
      .from('blocklist_selections')
      .upsert(
        {
          user_id: userId,
          selection_blob: blob,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.error('[BlocklistSync] Push failed:', error);
      throw error;
    }
  }

  /**
   * Pull blocklist blob from Supabase.
   * Returns the raw blob string, or null if no row exists.
   */
  static async pull(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('blocklist_selections')
      .select('selection_blob')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('[BlocklistSync] Pull failed:', error);
      throw error;
    }
    return data?.selection_blob ?? null;
  }

  /**
   * Full bidirectional sync using diff-based merge.
   *
   * @param userId - Supabase user ID
   * @param currentSelectionId - Named selection ID from Zustand (e.g. "bittersweet-blocklist")
   * @returns The canonical selection ID if local state changed,
   *          or null if no local change was needed.
   */
  static async sync(
    userId: string,
    currentSelectionId: string | null,
    skipBlocking = false
  ): Promise<string | null> {

    // Get the current local blob from the named ID
    const currentLocalBlob = currentSelectionId
      ? getFamilyActivitySelectionId(currentSelectionId) ?? null
      : null;

    // 1. Pull server blob
    const serverBlob = await BlocklistSyncService.pull(userId);

    // 2. Read last-synced baseline
    const lastSyncedBlob = await AsyncStorage.getItem(LAST_SYNCED_BLOB_KEY);

    if (!serverBlob || serverBlob === '') {
      // No server data — just push local and record baseline
      if (currentLocalBlob && currentLocalBlob !== '') {
        await BlocklistSyncService.pushBlob(userId, currentLocalBlob);
      }
      await AsyncStorage.setItem(LAST_SYNCED_BLOB_KEY, currentLocalBlob || '');
      return null;
    }

    if (!currentLocalBlob || currentLocalBlob === '') {
      // No local data — accept server blob entirely
      BlocklistSyncService.storeTempBlob(CANONICAL_SELECTION_ID, serverBlob);
      BlocklistSyncService.applyLocally(currentSelectionId, skipBlocking);
      await AsyncStorage.setItem(LAST_SYNCED_BLOB_KEY, serverBlob);
      return CANONICAL_SELECTION_ID;
    }

    // Store the server blob as a temp named selection for set operations
    BlocklistSyncService.storeTempBlob(TEMP_SERVER_ID, serverBlob);

    let mergedBlob: string;

    if (!lastSyncedBlob) {
      // First sync / baseline cleared — fallback to union (no removals detectable)
      const result = union(
        { activitySelectionId: currentSelectionId! },
        { activitySelectionId: TEMP_SERVER_ID },
        { persistAsActivitySelectionId: CANONICAL_SELECTION_ID }
      );
      mergedBlob = result?.familyActivitySelection || currentLocalBlob;
    } else {
      // Diff-based merge

      // Store baseline as temp named selection
      BlocklistSyncService.storeTempBlob(TEMP_BASELINE_ID, lastSyncedBlob);

      // localAdded = difference(currentLocal, lastSyncedBlob)
      const addedResult = difference(
        { activitySelectionId: currentSelectionId! },
        { activitySelectionId: TEMP_BASELINE_ID },
        { persistAsActivitySelectionId: TEMP_ADDED_ID }
      );

      // localRemoved = difference(lastSyncedBlob, currentLocal)
      const removedResult = difference(
        { activitySelectionId: TEMP_BASELINE_ID },
        { activitySelectionId: currentSelectionId! },
        { persistAsActivitySelectionId: TEMP_REMOVED_ID }
      );

      const hasAdded = (addedResult?.applicationCount ?? 0) +
        (addedResult?.categoryCount ?? 0) + (addedResult?.webDomainCount ?? 0) > 0;
      const hasRemoved = (removedResult?.applicationCount ?? 0) +
        (removedResult?.categoryCount ?? 0) + (removedResult?.webDomainCount ?? 0) > 0;

      if (!hasAdded && !hasRemoved) {
        // No local changes from baseline — just accept server blob
        BlocklistSyncService.storeTempBlob(CANONICAL_SELECTION_ID, serverBlob);
        mergedBlob = serverBlob;
      } else {
        // merged = difference(union(serverBlob, localAdded), localRemoved)
        if (hasAdded) {
          union(
            { activitySelectionId: TEMP_SERVER_ID },
            { activitySelectionId: TEMP_ADDED_ID },
            { persistAsActivitySelectionId: TEMP_SERVER_PLUS_ADDED_ID }
          );
        } else {
          // No additions — serverPlusAdded = server
          BlocklistSyncService.storeTempBlob(TEMP_SERVER_PLUS_ADDED_ID, serverBlob);
        }

        if (hasRemoved) {
          const finalResult = difference(
            { activitySelectionId: TEMP_SERVER_PLUS_ADDED_ID },
            { activitySelectionId: TEMP_REMOVED_ID },
            { persistAsActivitySelectionId: CANONICAL_SELECTION_ID }
          );
          mergedBlob = finalResult?.familyActivitySelection || serverBlob;
        } else {
          // No removals — merged = serverPlusAdded
          const spBlob = getFamilyActivitySelectionId(TEMP_SERVER_PLUS_ADDED_ID);
          BlocklistSyncService.storeTempBlob(CANONICAL_SELECTION_ID, spBlob || serverBlob);
          mergedBlob = spBlob || serverBlob;
        }
      }
    }

    // Read back the merged blob that was persisted
    const finalMergedBlob = getFamilyActivitySelectionId(CANONICAL_SELECTION_ID) || mergedBlob;

    const localChanged = finalMergedBlob !== currentLocalBlob;
    const serverChanged = finalMergedBlob !== serverBlob;

    // 3. Push merged to server if it differs
    if (serverChanged) {
      await BlocklistSyncService.pushBlob(userId, finalMergedBlob);
    }

    // 4. Persist new baseline
    await AsyncStorage.setItem(LAST_SYNCED_BLOB_KEY, finalMergedBlob);

    // 5. If local changed, apply locally
    if (localChanged) {
      BlocklistSyncService.applyLocally(currentSelectionId, skipBlocking);
      return CANONICAL_SELECTION_ID;
    }

    return null;
  }

  /**
   * Clear the last-synced baseline (call on sign-out).
   */
  static async clearBaseline(): Promise<void> {
    await AsyncStorage.removeItem(LAST_SYNCED_BLOB_KEY);
  }

  /**
   * Get counts (apps, categories, domains) for a named selection ID.
   */
  static getCounts(selectionId: string): {
    applicationCount: number;
    categoryCount: number;
    webDomainCount: number;
  } {
    const metadata = activitySelectionMetadata({
      activitySelectionId: selectionId,
    });
    return {
      applicationCount: metadata?.applicationCount ?? 0,
      categoryCount: metadata?.categoryCount ?? 0,
      webDomainCount: metadata?.webDomainCount ?? 0,
    };
  }

  /**
   * Import a blob from cloud and apply it locally (source-of-truth flow).
   * Used by pullAndApply when cloud data should overwrite local.
   *
   * @returns The canonical selection ID
   */
  static async importAndApply(
    blob: string,
    oldSelectionId: string | null,
    skipBlocking = false
  ): Promise<string> {
    BlocklistSyncService.storeTempBlob(CANONICAL_SELECTION_ID, blob);
    BlocklistSyncService.applyLocally(oldSelectionId, skipBlocking);
    await AsyncStorage.setItem(LAST_SYNCED_BLOB_KEY, blob);
    return CANONICAL_SELECTION_ID;
  }

  /**
   * True while the user has a paid unlock window open.
   *
   * Read HERE, immediately before the native `blockSelection()`, and never
   * passed in from a caller. `sync()` and `pullAndApply()` used to capture this
   * as a boolean before their network round trips (pull, push, AsyncStorage) and
   * hand the stale value down. A user who paid to unblock DURING that window —
   * the common case, because a cold start from the shield notification runs a
   * full sync while the unlock sheet is already on screen — was re-blocked by
   * the stale `false`, and the apps stayed shielded for the whole unlock. The
   * only way out was to cancel the unlock and buy it again.
   */
  private static isUnlockWindowOpen(): boolean {
    // Lazy require: the store imports this service, so a static import cycles.
    const { useAppStore } = require('../../store');
    const sessions = useAppStore.getState().blocklist.activeSessions.byId;
    const now = Date.now();
    return Object.values(sessions).some(
      (s: any) => s.isActive && new Date(s.endTime).getTime() > now
    );
  }

  /**
   * Apply native blocking for a selection ID, unless an unlock window is open.
   * Single choke point — every path that re-blocks goes through here.
   */
  private static blockUnlessUnlocked(selectionId: string, skipBlocking: boolean): void {
    if (skipBlocking) {
      return;
    }
    if (BlocklistSyncService.isUnlockWindowOpen()) {
      console.log('🔓 [BlocklistSync] Unlock window open — skipping blockSelection');
      return;
    }
    blockSelection({ activitySelectionId: selectionId });
  }

  /**
   * Re-apply native blocking for an existing selection ID.
   * Used on cold start when data hasn't changed but native state may have been cleared.
   */
  static reapplyBlocking(selectionId: string, skipBlocking = false): void {
    BlocklistSyncService.blockUnlessUnlocked(selectionId, skipBlocking);
  }

  // --- Edit-cost escalation (weekly, reinstall-proof) ---

  /** Push the weekly edit-cost counter to the user's blocklist row. */
  static async pushEditHistory(userId: string, editHistory: BlocklistEditHistory): Promise<void> {
    const { error } = await supabase.from('blocklist_selections').upsert(
      {
        user_id: userId,
        edit_week_start: editHistory.weekStart,
        edits_this_week: editHistory.editsThisWeek,
      },
      { onConflict: 'user_id' }
    );
    if (error) {
      console.error('[BlocklistSync] pushEditHistory failed:', error);
    }
  }

  /** Pull the weekly edit-cost counter, or null if the row/columns are empty. */
  static async pullEditHistory(userId: string): Promise<BlocklistEditHistory | null> {
    const { data, error } = await supabase
      .from('blocklist_selections')
      .select('edit_week_start, edits_this_week')
      .eq('user_id', userId)
      .single();
    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('[BlocklistSync] pullEditHistory failed:', error);
      }
      return null;
    }
    if (!data || data.edit_week_start == null) return null;
    return { weekStart: data.edit_week_start, editsThisWeek: data.edits_this_week ?? 0 };
  }

  /**
   * Merge two edit-cost counters. Both are first normalized to the CURRENT week
   * (a counter from a past week contributes 0 — that's the weekly reset), then we
   * take the max. Single-device app, so max() is the whole story: it preserves the
   * escalation across reinstall (cloud wins over an empty fresh install) while
   * still resetting on the calendar week boundary — never by reinstalling.
   */
  static mergeEditHistory(
    a: BlocklistEditHistory | null,
    b: BlocklistEditHistory | null
  ): BlocklistEditHistory {
    const week = getWeekStart().toISOString();
    const inWeek = (h: BlocklistEditHistory | null) =>
      h && h.weekStart === week ? h.editsThisWeek ?? 0 : 0;
    return { weekStart: week, editsThisWeek: Math.max(inWeek(a), inWeek(b)) };
  }

  // --- Private helpers ---

  /**
   * Push a raw blob string directly to Supabase.
   */
  private static async pushBlob(userId: string, blob: string): Promise<void> {
    const { error } = await supabase
      .from('blocklist_selections')
      .upsert(
        {
          user_id: userId,
          selection_blob: blob,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    if (error) {
      console.error('[BlocklistSync] pushBlob failed:', error);
      throw error;
    }
  }

  /**
   * Store a raw blob under a named selection ID in UserDefaults.
   */
  private static storeTempBlob(id: string, blob: string): void {
    setFamilyActivitySelectionId({ id, familyActivitySelection: blob });
  }

  /**
   * Swap blocking from old selection to the canonical selection.
   * If skipBlocking is true, still clean up old selection but don't apply
   * native blocking (used when an unlock session is active so we don't
   * re-block prematurely — the updated blob is still stored under the
   * canonical ID and will be used when the unlock expires). An unlock that
   * started after the caller captured that flag is caught by the live check in
   * blockUnlessUnlocked().
   */
  private static applyLocally(oldSelectionId: string | null, skipBlocking = false): void {
    if (oldSelectionId && oldSelectionId !== CANONICAL_SELECTION_ID) {
      unblockSelection({ activitySelectionId: oldSelectionId });
    }
    BlocklistSyncService.blockUnlessUnlocked(CANONICAL_SELECTION_ID, skipBlocking);
  }
}
