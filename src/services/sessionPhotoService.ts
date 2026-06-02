import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../config/supabase';

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

export async function deleteSessionPhoto(sessionId: string): Promise<void> {
  const fileUri = `${PHOTOS_DIR}${sessionId}.jpg`;
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(fileUri);
  }
}
