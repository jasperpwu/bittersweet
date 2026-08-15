import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../config/supabase';
import { useAppStore } from '../store';

const PHOTOS_DIR = `${FileSystem.documentDirectory}session-photos/`;

async function ensurePhotosDir() {
  const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export async function saveSessionPhoto(
  imageUri: string,
  sessionId: string
): Promise<string> {
  await ensurePhotosDir();

  // Compress and resize
  const result = await manipulateAsync(
    imageUri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: SaveFormat.JPEG }
  );

  const destUri = `${PHOTOS_DIR}${sessionId}.jpg`;

  await FileSystem.copyAsync({ from: result.uri, to: destUri });

  return destUri;
}

/**
 * Upload a session photo to Supabase Storage (session-photos bucket).
 * Compresses to max 1200px JPEG, returns the public URL.
 */
export async function uploadSessionPhoto(
  imageUri: string,
  sessionId: string
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Compress and resize
  const result = await manipulateAsync(
    imageUri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: SaveFormat.JPEG }
  );

  // Read as blob → ArrayBuffer
  const response = await fetch(result.uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const filePath = `${user.id}/${sessionId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('session-photos')
    .upload(filePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('session-photos')
    .getPublicUrl(filePath);

  // Append cache-buster to force refresh
  return `${urlData.publicUrl}?t=${Date.now()}`;
}

/**
 * Re-upload photos stuck with a local file:// photoUrl. Older builds attached
 * photos via the journal manual/edit forms without ever uploading them, so the
 * local path synced to the cloud and friends' feeds couldn't render it.
 * Sessions whose local copy no longer exists are skipped (nothing to recover).
 */
export async function backfillLocalSessionPhotos(): Promise<void> {
  const { sessions } = useAppStore.getState().focus;
  const staleIds = sessions.allIds.filter((id) =>
    sessions.byId[id]?.photoUrl?.startsWith('file://')
  );
  if (staleIds.length === 0) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  console.log(`📷 Backfilling ${staleIds.length} local session photo(s) to cloud`);
  for (const id of staleIds) {
    // The stored URL embeds the app container UUID, which changes on
    // reinstall/update — prefer the canonical path derived from the id.
    const storedUrl = sessions.byId[id].photoUrl!;
    const canonicalUri = `${PHOTOS_DIR}${id}.jpg`;
    let sourceUri: string | null = null;
    if ((await FileSystem.getInfoAsync(canonicalUri)).exists) {
      sourceUri = canonicalUri;
    } else if ((await FileSystem.getInfoAsync(storedUrl)).exists) {
      sourceUri = storedUrl;
    }
    if (!sourceUri) continue;

    try {
      const cloudUrl = await uploadSessionPhoto(sourceUri, id);
      useAppStore.getState().focus.updateSession(id, { photoUrl: cloudUrl });
    } catch (error) {
      console.warn('Failed to backfill photo for session:', id, error);
    }
  }
}

export async function deleteSessionPhoto(sessionId: string): Promise<void> {
  const fileUri = `${PHOTOS_DIR}${sessionId}.jpg`;
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(fileUri);
  }
}

/**
 * Delete every locally saved session photo (the whole directory). Part of the
 * "wipe all local data" sequence on sign-out/user-switch — no photo may
 * survive for the next person on the device. Cloud copies are untouched.
 */
export async function deleteAllSessionPhotos(): Promise<void> {
  await FileSystem.deleteAsync(PHOTOS_DIR, { idempotent: true });
}
