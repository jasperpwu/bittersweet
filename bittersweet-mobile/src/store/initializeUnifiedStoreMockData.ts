/**
 * Initialize unified store with mock data for development and testing
 */

import { useUnifiedStore } from './unified-store';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Mock user ID for consistency
const MOCK_USER_ID = 'unified-test-user-123';

// Helper functions to generate dates
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/**
 * Creates a comprehensive mock user for the unified store
 */
const createMockUnifiedUser = () => ({
  id: MOCK_USER_ID,
  email: 'demo@bittersweet.app',
  name: 'Demo User',
  avatar: undefined,
  createdAt: daysAgo(30),
  updatedAt: new Date(),
  deviceInfo: {
    deviceId: Device.deviceName || 'Demo-Device',
    deviceName: Device.deviceName || 'Demo Device',
    platform: Platform.OS as 'ios' | 'android',
    osVersion: Device.osVersion || '17.0',
    appVersion: '1.0.0',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: 'en-US',
  },
  preferences: {
    theme: 'dark' as const,
    language: 'en',
    notifications: {
      enabled: true,
      sessionReminders: true,
      breakReminders: true,
      dailyGoals: true,
      squadUpdates: false,
    },
    privacy: {
      shareStats: true,
      allowFriendRequests: true,
      showOnlineStatus: true,
    },
    focus: {
      defaultDuration: 25,
      breakDuration: 5,
      longBreakDuration: 15,
      sessionsUntilLongBreak: 4,
      autoStartBreaks: false,
      autoStartSessions: false,
      soundEnabled: true,
      vibrationEnabled: true,
    },
  },
  stats: {
    totalFocusTime: 1175, // 19+ hours
    totalSessions: 47,
    currentStreak: 8,
    longestStreak: 15,
    seedsEarned: 2350,
    level: 6,
    experience: 1175,
    lastActiveDate: new Date(),
  },
});

/**
 * Initializes the unified store with comprehensive mock data
 */
export const initializeUnifiedStoreWithMockData = () => {
  try {
    console.log('🎭 Initializing unified store with mock data...');

    const mockUser = createMockUnifiedUser();
    
    // Get current store state
    const currentState = useUnifiedStore.getState();
    
    // Initialize the unified store with mock user data
    useUnifiedStore.setState({
      user: mockUser,
      isAuthenticated: true,
      loading: {
        ...currentState.loading,
        auth: false,
        profile: false,
      },
      errors: [], // Clear any existing errors
    });

    console.log('✅ Unified store mock data initialization completed!');
    console.log('👤 Demo user logged in:', mockUser.name, `(${mockUser.email})`);
    console.log('📊 User stats:');
    console.log(`  - Level: ${mockUser.stats.level}`);
    console.log(`  - Seeds: ${mockUser.stats.seedsEarned}`);
    console.log(`  - Streak: ${mockUser.stats.currentStreak} days`);
    console.log(`  - Focus time: ${mockUser.stats.totalFocusTime} minutes`);
    console.log('⚙️  Preferences:');
    console.log(`  - Theme: ${mockUser.preferences.theme}`);
    console.log(`  - Notifications: ${mockUser.preferences.notifications.enabled ? 'On' : 'Off'}`);
    console.log(`  - Focus session: ${mockUser.preferences.focus.defaultDuration} min`);

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize unified store mock data:', error);
    return false;
  }
};

/**
 * Check if the unified store should be initialized with mock data
 */
export const shouldInitializeUnifiedMockData = (): boolean => {
  if (process.env.NODE_ENV === 'development') {
    const store = useUnifiedStore.getState();
    return !store.isAuthenticated && !store.user;
  }
  return false;
};

/**
 * Auto-initialize unified store mock data if conditions are met
 */
export const autoInitializeUnifiedMockData = () => {
  if (shouldInitializeUnifiedMockData()) {
    setTimeout(() => {
      console.log('🔧 Auto-initializing unified store with mock data...');
      initializeUnifiedStoreWithMockData();
    }, 100); // Minimal delay to ensure unified store is ready
  }
};