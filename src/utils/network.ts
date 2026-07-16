import NetInfo from '@react-native-community/netinfo';

/**
 * True when NetInfo confirms the device has no usable connection.
 * Mirrors the store's online check: `isInternetReachable` can be null while
 * the reachability probe is still running, and that must not count as offline.
 * If NetInfo itself fails, assume online so a bad reading never blocks the user.
 */
export async function isDeviceOffline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !(state.isConnected === true && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}
