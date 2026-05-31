import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

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

export async function deleteSessionPhoto(sessionId: string): Promise<void> {
  const fileUri = `${PHOTOS_DIR}${sessionId}.jpg`;
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(fileUri);
  }
}
