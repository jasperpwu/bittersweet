import { supabase } from '../../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export class BlocklistSyncService {
  /**
   * Push the blob for a named local selection ID to Supabase.
   * Reads the raw blob from UserDefaults via the named ID.
   */
  static async push(userId: string, selectionId: string): Promise<void> {
    const blob = getFamilyActivitySelectionId(selectionId);
    if (!blob) {
      console.log('[BlocklistSync] No blob found for selectionId:', selectionId);
      return;
    }

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
    console.log('[BlocklistSync] Pushed blob to cloud');
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
    currentSelectionId: string | null
  ): Promise<string | null> {
    console.log('[BlocklistSync] Starting sync...');

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
      console.log('[BlocklistSync] No server data, pushing local');
      if (currentLocalBlob && currentLocalBlob !== '') {
        await BlocklistSyncService.pushBlob(userId, currentLocalBlob);
      }
      await AsyncStorage.setItem(LAST_SYNCED_BLOB_KEY, currentLocalBlob || '');
      return null;
    }

    if (!currentLocalBlob || currentLocalBlob === '') {
      // No local data — accept server blob entirely
      console.log('[BlocklistSync] No local data, accepting server blob');
      BlocklistSyncService.storeTempBlob(CANONICAL_SELECTION_ID, serverBlob);
      BlocklistSyncService.applyLocally(currentSelectionId);
      await AsyncStorage.setItem(LAST_SYNCED_BLOB_KEY, serverBlob);
      return CANONICAL_SELECTION_ID;
    }

    // Store the server blob as a temp named selection for set operations
    BlocklistSyncService.storeTempBlob(TEMP_SERVER_ID, serverBlob);

    let mergedBlob: string;

    if (!lastSyncedBlob) {
      // First sync / baseline cleared — fallback to union (no removals detectable)
      console.log('[BlocklistSync] No baseline — using union fallback');
      const result = union(
        { activitySelectionId: currentSelectionId! },
        { activitySelectionId: TEMP_SERVER_ID },
        { persistAsActivitySelectionId: CANONICAL_SELECTION_ID }
      );
      mergedBlob = result?.familyActivitySelection || currentLocalBlob;
    } else {
      // Diff-based merge
      console.log('[BlocklistSync] Diff-based merge');

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
        console.log('[BlocklistSync] No local changes, accepting server');
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
      console.log('[BlocklistSync] Pushing merged blob to server');
      await BlocklistSyncService.pushBlob(userId, finalMergedBlob);
    }

    // 4. Persist new baseline
    await AsyncStorage.setItem(LAST_SYNCED_BLOB_KEY, finalMergedBlob);

    // 5. If local changed, apply locally
    if (localChanged) {
      console.log('[BlocklistSync] Local blocklist changed — applying merged blob');
      BlocklistSyncService.applyLocally(currentSelectionId);
      return CANONICAL_SELECTION_ID;
    }

    console.log('[BlocklistSync] Sync complete — no local changes needed');
    return null;
  }

  /**
   * Clear the last-synced baseline (call on sign-out).
   */
  static async clearBaseline(): Promise<void> {
    await AsyncStorage.removeItem(LAST_SYNCED_BLOB_KEY);
    console.log('[BlocklistSync] Baseline cleared');
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
    oldSelectionId: string | null
  ): Promise<string> {
    console.log('[BlocklistSync] importAndApply — applying cloud blob');
    BlocklistSyncService.storeTempBlob(CANONICAL_SELECTION_ID, blob);
    BlocklistSyncService.applyLocally(oldSelectionId);
    await AsyncStorage.setItem(LAST_SYNCED_BLOB_KEY, blob);
    return CANONICAL_SELECTION_ID;
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
   */
  private static applyLocally(oldSelectionId: string | null): void {
    if (oldSelectionId && oldSelectionId !== CANONICAL_SELECTION_ID) {
      unblockSelection({ activitySelectionId: oldSelectionId });
    }
    blockSelection({ activitySelectionId: CANONICAL_SELECTION_ID });
  }
}
