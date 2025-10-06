import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { DeviceActivityListener } from '../services/deviceActivity/DeviceActivityListener';
import { useBlocklist } from '../store';

/**
 * Hook to manage Device Activity Listener lifecycle
 *
 * This hook automatically starts/stops the listener based on app state
 * and blocklist settings.
 */
export function useDeviceActivityListener() {
  const { settings, isAuthorized } = useBlocklist();

  useEffect(() => {
    // Only start listening if blocklist is enabled and authorized
    if (!settings.isEnabled || !isAuthorized) {
      DeviceActivityListener.stopListening();
      return;
    }

    // Start listening when component mounts
    DeviceActivityListener.startListening();

    // Handle app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // App became active - start listening
        if (settings.isEnabled && isAuthorized) {
          DeviceActivityListener.startListening();
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App went to background - listener continues running
        // but we might want to perform cleanup or state sync
        console.log('📱 App went to background, Device Activity Listener continues...');
      }
    };

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup function
    return () => {
      subscription?.remove();
      DeviceActivityListener.stopListening();
    };
  }, [settings.isEnabled, isAuthorized]);

  // Return listener status for debugging
  return {
    isListening: settings.isEnabled && isAuthorized,
    settings,
    isAuthorized
  };
}