/**
 * Unified Zustand store with React Native integration
 * Simple app preferences and focus settings
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Types
interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: 'ios' | 'android' | 'web';
  osVersion: string;
  appVersion: string;
  timezone: string;
  locale: string;
}

interface AppPreferences {
  hasSeenOnboarding: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: NotificationSettings;
  focus: FocusSettings;
  restDays: number[];    // day indices (0=Sun..6=Sat), default [0, 6]
  weekStartDay: number;  // 0=Sun..6=Sat, default 0
}

interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  sessionReminders: boolean;
  breakReminders: boolean;
  dailyGoals: boolean;
  goalReminderEnabled: boolean;
  goalReminderTime: string; // "HH:MM" format
}

interface FocusSettings {
  defaultDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  autoStartBreaks: boolean;
  autoStartSessions: boolean;
  timerPickerStyle: 'scroller' | 'wheel';
}

interface AppStats {
  totalFocusTime: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
}

interface AppState {
  isHydrated: boolean;
  isOnline: boolean;
  appState: 'active' | 'background' | 'inactive';
  lastSyncDate?: Date;
}

interface UnifiedStore {
  // App state
  app: AppState;
  
  // Device info
  deviceInfo: DeviceInfo | null;
  
  // User preferences
  preferences: AppPreferences;
  
  // User stats
  stats: AppStats;
  
  // Loading states
  loading: {
    app: boolean;
    preferences: boolean;
  };
  
  // Error state
  errors: string[];
  
  // Actions
  initializeApp: () => Promise<void>;
  updatePreferences: (updates: Partial<AppPreferences>) => Promise<void>;
  updateStats: (updates: Partial<AppStats>) => void;
  clearErrors: () => void;
  addError: (error: string) => void;
  
  // Getters
  getPreferences: () => AppPreferences;
  getStats: () => AppStats;
  getTheme: () => 'light' | 'dark' | 'system';
}

// Helper functions
const getDeviceInfo = async (): Promise<DeviceInfo> => {
  const deviceId = Device.osInternalBuildId || 'unknown';
  const deviceName = Device.deviceName || 'Unknown Device';
  const platform = Platform.OS as 'ios' | 'android';
  const osVersion = Device.osVersion || 'Unknown';
  const appVersion = '1.0.0'; // This should come from app.json
  
  // Get timezone and locale
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  
  return {
    deviceId,
    deviceName,
    platform,
    osVersion,
    appVersion,
    timezone,
    locale,
  };
};

const createDefaultPreferences = (): AppPreferences => ({
  hasSeenOnboarding: false,
  theme: 'system',
  language: 'en',
  notifications: {
    enabled: true,
    sound: true,
    vibration: true,
    sessionReminders: true,
    breakReminders: true,
    dailyGoals: true,
    goalReminderEnabled: true,
    goalReminderTime: '20:00',
  },
  focus: {
    defaultDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    sessionsUntilLongBreak: 4,
    soundEnabled: true,
    vibrationEnabled: true,
    autoStartBreaks: false,
    autoStartSessions: false,
    timerPickerStyle: 'scroller',
  },
  restDays: [0, 6],
  weekStartDay: 0,
});

const createDefaultStats = (): AppStats => ({
  totalFocusTime: 0,
  totalSessions: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: new Date(),
});

// Create the unified store
export const useUnifiedStore = create<UnifiedStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        app: {
          isHydrated: false,
          isOnline: true,
          appState: 'active',
        },
        deviceInfo: null,
        preferences: createDefaultPreferences(),
        stats: createDefaultStats(),
        loading: {
          app: false,
          preferences: false,
        },
        errors: [],
        
        // Actions
        initializeApp: async () => {
          try {
            const deviceInfo = await getDeviceInfo();
            
            set((state) => ({
              deviceInfo,
              app: {
                ...state.app,
                isHydrated: true,
              },
            }));
            
            if (__DEV__) {
              console.log('✅ App initialized with device info:', deviceInfo);
            }
          } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            get().addError('Failed to initialize app');
          }
        },
        
        updatePreferences: async (updates) => {
          try {
            const updatedPreferences = {
              ...get().preferences,
              ...updates,
              notifications: {
                ...get().preferences.notifications,
                ...updates.notifications,
              },
              focus: {
                ...get().preferences.focus,
                ...updates.focus,
              },
            };

            set({ preferences: updatedPreferences });

            if (__DEV__) {
              console.log('✅ Preferences updated');
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Preferences update failed';
            get().addError(errorMessage);
            throw error;
          }
        },
        
        updateStats: (updates) => {
          const updatedStats = {
            ...get().stats,
            ...updates,
            lastActiveDate: new Date(),
          };
          
          set({ stats: updatedStats });
        },
        
        clearErrors: () => {
          set({ errors: [] });
        },
        
        addError: (error) => {
          set((state) => ({
            errors: [...state.errors, error],
          }));
        },
        
        // Getters
        getPreferences: () => get().preferences,
        getStats: () => get().stats,
        getTheme: () => get().preferences.theme,
      }),
      {
        name: 'bittersweet-unified-store',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          preferences: state.preferences,
          stats: state.stats,
        }),
      }
    ),
    { name: 'bittersweet-store' }
  )
);

// Convenience hooks
export const useAppSettings = () => useUnifiedStore((state) => ({
  preferences: state.preferences,
  updatePreferences: state.updatePreferences,
  theme: state.getTheme(),
}));

export const useAppStats = () => useUnifiedStore((state) => ({
  stats: state.stats,
  updateStats: state.updateStats,
}));

export const useAppState = () => useUnifiedStore((state) => ({
  isHydrated: state.app.isHydrated,
  isOnline: state.app.isOnline,
  appState: state.app.appState,
  initializeApp: state.initializeApp,
}));

// Initialize the store
export const initializeUnifiedStore = async () => {
  const store = useUnifiedStore.getState();
  await store.initializeApp();
};