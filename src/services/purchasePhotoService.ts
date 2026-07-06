import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '../config/supabase';

// Photos users attach to bought custom rewards in the fruit store's purchase
// history. Same lifecycle as sessionPhotoService: save a compressed local copy
// first (works offline), then try to upload to the `purchase-photos` bucket
// and store the public URL on the purchase row so it survives reinstalls.
const PHOTOS_DIR = `${FileSystem.documentDirectory}purchase-photos/`;

async function ensurePhotosDir() {
  const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export async function savePurchasePhoto(imageUri: string, purchaseId: string): Promise<string> {
  await ensurePhotosDir();

  // Compress and resize
  const result = await manipulateAsync(imageUri, [{ resize: { width: 1200 } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });

  const destUri = `${PHOTOS_DIR}${purchaseId}.jpg`;

  await FileSystem.copyAsync({ from: result.uri, to: destUri });

  return destUri;
}

/**
 * Upload a purchase photo to Supabase Storage (purchase-photos bucket).
 * Compresses to max 1200px JPEG, returns the public URL.
 */
export async function uploadPurchasePhoto(imageUri: string, purchaseId: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Compress and resize
  const result = await manipulateAsync(imageUri, [{ resize: { width: 1200 } }], {
    compress: 0.8,
    format: SaveFormat.JPEG,
  });

  // Read as blob → ArrayBuffer
  const response = await fetch(result.uri);
  const blob = await response.blob();
  const arrayBuffer = await new Response(blob).arrayBuffer();

  const filePath = `${user.id}/${purchaseId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('purchase-photos')
    .upload(filePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('purchase-photos').getPublicUrl(filePath);

  // Append cache-buster to force refresh
  return `${urlData.publicUrl}?t=${Date.now()}`;
}

export async function deletePurchasePhoto(purchaseId: string): Promise<void> {
  const fileUri = `${PHOTOS_DIR}${purchaseId}.jpg`;
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(fileUri);
  }
}

/**
 * Delete every locally saved purchase photo (the whole directory). Part of the
 * "wipe all local data" sequence on sign-out/user-switch — no photo may
 * survive for the next person on the device. Cloud copies are untouched.
 */
export async function deleteAllPurchasePhotos(): Promise<void> {
  await FileSystem.deleteAsync(PHOTOS_DIR, { idempotent: true });
}
