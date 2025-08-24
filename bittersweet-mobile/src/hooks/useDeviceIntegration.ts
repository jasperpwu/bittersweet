/**
 * React Native device integration hook
 * Provides access to device capabilities and system information
 */

import { useEffect, useState } from 'react';
import { Platform, AppState, Dimensions } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUnifiedStore } from '../store/unified-store';

interface DeviceCapabilities {
  hasNotifications: boolean;
  hasHaptics: boolean;
  hasSecureStorage: boolean;
  hasBiometrics: boolean;
  screenDimensions: {
    width: number;
    height: number;
    scale: number;
  };
  deviceInfo: {
    brand: string;
    modelName: string;
    osName: string;
    osVersion: string;
    isDevice: boolean;
  };
}

interface SystemIntegration {
  requestNotificationPermissions: () => Promise<boolean>;
  scheduleNotification: (title: string, body: string, trigger?: Date) => Promise<string | null>;
  cancelNotification: (id: string) => Promise<void>;
  triggerHaptic: (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error') => void;
  storeSecurely: (key: string, value: string) => Promise<void>;
  getSecurely: (key: string) => Promise<string | null>;
  deleteSecurely: (key: string) => Promise<void>;
  storeLocally: (key: string, value: string) => Promise<void>;
  getLocally: (key: string) => Promise<string | null>;
  deleteLocally: (key: string) => Promise<void>;
}

export const useDeviceIntegration = (): DeviceCapabilities & SystemIntegration => {
  const [capabilities, setCapabilities] = useState<DeviceCapabilities>({
    hasNotifications: false,
    hasHaptics: false,
    hasSecureStorage: false,
    hasBiometrics: false,
    screenDimensions: {
      width: 0,
      height: 0,
      scale: 1,
    },
    deviceInfo: {
      brand: 'Unknown',
      modelName: 'Unknown',
      osName: Platform.OS,
      osVersion: 'Unknown',
      isDevice: false,
    },
  });

  const updateStats = useUnifiedStore((state) => state.updateStats);

  useEffect(() => {
    const initializeCapabilities = async () => {
      try {
        // Screen dimensions
        const { width, height, scale } = Dimensions.get('window');
        
        // Device info
        const deviceInfo = {
          brand: Device.brand || 'Unknown',
          modelName: Device.modelName || 'Unknown',
          osName: Device.osName || Platform.OS,
          osVersion: Device.osVersion || 'Unknown',
          isDevice: Device.isDevice || false,
        };

        // Check notification permissions
        const { status: notificationStatus } = await Notifications.getPermissionsAsync();
        const hasNotifications = notificationStatus === 'granted';

        // Check haptics (always available on iOS, limited on Android)
        const hasHaptics = Platform.OS === 'ios' || Platform.OS === 'android';

        // Check secure storage
        const hasSecureStorage = await SecureStore.isAvailableAsync();

        // Check biometrics (would need additional setup)
        const hasBiometrics = false; // Placeholder

        setCapabilities({
          hasNotifications,
          hasHaptics,
          hasSecureStorage,
          hasBiometrics,
          screenDimensions: { width, height, scale },
          deviceInfo,
        });

        if (__DEV__) {
          console.log('✅ Device capabilities initialized:', {
            hasNotifications,
            hasHaptics,
            hasSecureStorage,
            deviceInfo,
          });
        }
      } catch (error) {
        console.error('❌ Failed to initialize device capabilities:', error);
      }
    };

    initializeCapabilities();

    // Listen for app state changes
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Update last active time when app becomes active
        updateStats({ lastActiveDate: new Date() });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Listen for dimension changes
    const dimensionSubscription = Dimensions.addEventListener('change', ({ window }) => {
      setCapabilities(prev => ({
        ...prev,
        screenDimensions: {
          width: window.width,
          height: window.height,
          scale: window.scale,
        },
      }));
    });

    return () => {
      subscription?.remove();
      dimensionSubscription?.remove();
    };
  }, [updateStats]);

  // System integration functions
  const requestNotificationPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === 'granted';
      
      setCapabilities(prev => ({
        ...prev,
        hasNotifications: granted,
      }));
      
      return granted;
    } catch (error) {
      console.error('Failed to request notification permissions:', error);
      return false;
    }
  };

  const scheduleNotification = async (
    title: string,
    body: string,
    trigger?: Date
  ): Promise<string | null> => {
    try {
      if (!capabilities.hasNotifications) {
        const granted = await requestNotificationPermissions();
        if (!granted) return null;
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
        },
        trigger: trigger ? { date: trigger } : null,
      });

      return id;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  };

  const cancelNotification = async (id: string): Promise<void> => {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  };

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'): void => {
    if (!capabilities.hasHaptics) return;

    try {
      switch (type) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    } catch (error) {
      console.error('Failed to trigger haptic feedback:', error);
    }
  };

  const storeSecurely = async (key: string, value: string): Promise<void> => {
    try {
      if (capabilities.hasSecureStorage) {
        await SecureStore.setItemAsync(key, value);
      } else {
        // Fallback to AsyncStorage
        await AsyncStorage.setItem(`secure_${key}`, value);
      }
    } catch (error) {
      console.error('Failed to store securely:', error);
      throw error;
    }
  };

  const getSecurely = async (key: string): Promise<string | null> => {
    try {
      if (capabilities.hasSecureStorage) {
        return await SecureStore.getItemAsync(key);
      } else {
        // Fallback to AsyncStorage
        return await AsyncStorage.getItem(`secure_${key}`);
      }
    } catch (error) {
      console.error('Failed to get securely:', error);
      return null;
    }
  };

  const deleteSecurely = async (key: string): Promise<void> => {
    try {
      if (capabilities.hasSecureStorage) {
        await SecureStore.deleteItemAsync(key);
      } else {
        // Fallback to AsyncStorage
        await AsyncStorage.removeItem(`secure_${key}`);
      }
    } catch (error) {
      console.error('Failed to delete securely:', error);
    }
  };

  const storeLocally = async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Failed to store locally:', error);
      throw error;
    }
  };

  const getLocally = async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Failed to get locally:', error);
      return null;
    }
  };

  const deleteLocally = async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to delete locally:', error);
    }
  };

  return {
    ...capabilities,
    requestNotificationPermissions,
    scheduleNotification,
    cancelNotification,
    triggerHaptic,
    storeSecurely,
    getSecurely,
    deleteSecurely,
    storeLocally,
    getLocally,
    deleteLocally,
  };
};