/**
 * Unified Zustand store with React Native integration
 * Simple app preferences and focus settings
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
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

// Apple Health integration (device-local only — intentionally NOT synced to cloud).
interface HealthKitPreferences {
  enabled: boolean;            // user connected Apple Health and wants workout import
  linkedTagId: string | null;  // tag that imported workouts are filed under
  anchor: string | null;       // opaque HealthKit query anchor for incremental fetch
}

interface AppPreferences {
  hasSeenOnboarding: boolean;
  hasSeenFruitCoachMark: boolean;
  hasSeenTagSwipeHint: boolean;
  hasSeenGoalSwipeHint: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: NotificationSettings;
  focus: FocusSettings;
  restDays: number[];    // day indices (0=Sun..6=Sat), default [0, 6]
  weekStartDay: number;  // 0=Sun..6=Sat, default 0
  adhdModeEnabled: boolean; // premium-only; unlocks a secondary tag per session
  healthKit: HealthKitPreferences;
  // Focus-rating motion consent (device-local — like healthKit, intentionally NOT synced).
  // Off by default: the suggested rating uses only retroactive CMMotionActivity/pedometer.
  // When on (explicit consent), we also record raw accelerometer during sessions for a
  // finer-grained estimate.
  rawAccelRatingEnabled: boolean;
  // Whether the one-time motion-permission priming pop-up has been shown on the summary.
  hasSeenMotionPrimer: boolean;
  // Whether the one-time post-session Grove profile setup prompt has been shown.
  hasSeenGroveSetupPrompt: boolean;
  // Applied fruit-store slider theme (see config/sliderThemes.ts); null = classic look.
  // Cloud-synced via user_settings.slider_theme_id (ownership syncs separately via
  // purchase history). Wiped by clearUnifiedStoreData.
  sliderThemeId: string | null;
}

interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  goalReminderEnabled: boolean;
  goalReminderTime: string; // "HH:MM" format
}

interface FocusSettings {
  defaultDuration: number;
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
  hasSeenFruitCoachMark: false,
  hasSeenTagSwipeHint: false,
  hasSeenGoalSwipeHint: false,
  theme: 'system',
  language: 'en',
  notifications: {
    enabled: true,
    sound: true,
    vibration: true,
    goalReminderEnabled: true,
    goalReminderTime: '20:00',
  },
  focus: {
    defaultDuration: 25,
    timerPickerStyle: 'scroller',
  },
  restDays: [0, 6],
  weekStartDay: 1,
  adhdModeEnabled: false,
  healthKit: {
    enabled: false,
    linkedTagId: null,
    anchor: null,
  },
  rawAccelRatingEnabled: false,
  hasSeenMotionPrimer: false,
  hasSeenGroveSetupPrompt: false,
  sliderThemeId: null,
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
              healthKit: {
                ...get().preferences.healthKit,
                ...updates.healthKit,
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
        // Deep-merge persisted prefs over current defaults so nested keys added in
        // newer versions (e.g. `healthKit`) are backfilled for existing users instead
        // of being left `undefined` by zustand's default shallow merge.
        merge: (persisted: any, current: any) => {
          const p = persisted ?? {};
          const cp = current.preferences;
          const pp = p.preferences ?? {};
          return {
            ...current,
            ...p,
            preferences: {
              ...cp,
              ...pp,
              notifications: { ...cp.notifications, ...pp.notifications },
              focus: { ...cp.focus, ...pp.focus },
              healthKit: { ...cp.healthKit, ...pp.healthKit },
            },
            stats: { ...current.stats, ...p.stats },
          };
        },
      }
    ),
    { name: 'bittersweet-store' }
  )
);

// Convenience hooks
export const useAppSettings = () => useUnifiedStore(useShallow((state) => ({
  preferences: state.preferences,
  updatePreferences: state.updatePreferences,
  theme: state.getTheme(),
})));

export const useAppStats = () => useUnifiedStore(useShallow((state) => ({
  stats: state.stats,
  updateStats: state.updateStats,
})));

export const useAppState = () => useUnifiedStore(useShallow((state) => ({
  isHydrated: state.app.isHydrated,
  isOnline: state.app.isOnline,
  appState: state.app.appState,
  initializeApp: state.initializeApp,
})));

// Initialize the store
export const initializeUnifiedStore = async () => {
  const store = useUnifiedStore.getState();
  await store.initializeApp();
};

/**
 * Resets the unified store to its default/empty state.
 */
export const clearUnifiedStoreData = () => {
  console.log('🧹 Clearing all local unified store data');
  useUnifiedStore.setState({
    preferences: createDefaultPreferences(),
    stats: createDefaultStats(),
    errors: [],
    loading: {
      app: false,
      preferences: false,
    }
  });
};