/**
 * Unified Zustand store with React Native integration
 * Comprehensive user management with device info, preferences, and persistence
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Types
interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
  deviceInfo: DeviceInfo;
  preferences: UserPreferences;
  stats: UserStats;
}

interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: 'ios' | 'android' | 'web';
  osVersion: string;
  appVersion: string;
  pushToken?: string;
  timezone: string;
  locale: string;
}

interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  focus: FocusSettings;
}

interface NotificationSettings {
  enabled: boolean;
  sessionReminders: boolean;
  breakReminders: boolean;
  dailyGoals: boolean;
  squadUpdates: boolean;
  pushToken?: string;
}

interface PrivacySettings {
  shareStats: boolean;
  allowFriendRequests: boolean;
  showOnlineStatus: boolean;
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
}

interface UserStats {
  totalFocusTime: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  seedsEarned: number;
  level: number;
  experience: number;
  lastActiveDate: Date;
}

interface AppState {
  isHydrated: boolean;
  isOnline: boolean;
  appState: 'active' | 'background' | 'inactive';
  lastSyncDate?: Date;
}

interface UnifiedStore {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;
  refreshToken: string | null;
  
  // App state
  app: AppState;
  
  // Loading states
  loading: {
    auth: boolean;
    profile: boolean;
    sync: boolean;
  };
  
  // Error state
  errors: string[];
  
  // Actions
  initializeApp: () => Promise<void>;
  loginUser: (credentials: { email: string; password: string }) => Promise<void>;
  logoutUser: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  updateStats: (updates: Partial<UserStats>) => void;
  clearErrors: () => void;
  addError: (error: string) => void;
  syncData: () => Promise<void>;
  
  // Getters
  getUser: () => User | null;
  getPreferences: () => UserPreferences;
  getStats: () => UserStats;
  isLoggedIn: () => boolean;
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
  
  // Get push notification token
  let pushToken: string | undefined;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      const token = await Notifications.getExpoPushTokenAsync();
      pushToken = token.data;
    }
  } catch (error) {
    console.warn('Failed to get push token:', error);
  }
  
  return {
    deviceId,
    deviceName,
    platform,
    osVersion,
    appVersion,
    pushToken,
    timezone,
    locale,
  };
};

const createDefaultPreferences = (): UserPreferences => ({
  theme: 'system',
  language: 'en',
  notifications: {
    enabled: true,
    sessionReminders: true,
    breakReminders: true,
    dailyGoals: true,
    squadUpdates: true,
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
    soundEnabled: true,
    vibrationEnabled: true,
    autoStartBreaks: false,
    autoStartSessions: false,
  },
});

const createDefaultStats = (): UserStats => ({
  totalFocusTime: 0,
  totalSessions: 0,
  currentStreak: 0,
  longestStreak: 0,
  seedsEarned: 0,
  level: 1,
  experience: 0,
  lastActiveDate: new Date(),
});

// Create the unified store
export const useUnifiedStore = create<UnifiedStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        user: null,
        isAuthenticated: false,
        authToken: null,
        refreshToken: null,
        app: {
          isHydrated: false,
          isOnline: true,
          appState: 'active',
        },
        loading: {
          auth: false,
          profile: false,
          sync: false,
        },
        errors: [],
        
        // Actions
        initializeApp: async () => {
          try {
            const deviceInfo = await getDeviceInfo();
            
            set((state) => ({
              app: {
                ...state.app,
                isHydrated: true,
              },
            }));
            
            // If user exists, update device info
            const currentUser = get().user;
            if (currentUser) {
              set((state) => ({
                user: {
                  ...currentUser,
                  deviceInfo,
                  updatedAt: new Date(),
                },
              }));
            }
            
            if (__DEV__) {
              console.log('✅ App initialized with device info:', deviceInfo);
            }
          } catch (error) {
            console.error('❌ Failed to initialize app:', error);
            get().addError('Failed to initialize app');
          }
        },
        
        loginUser: async (credentials) => {
          set((state) => ({
            loading: { ...state.loading, auth: true },
            errors: [],
          }));
          
          try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            if (!credentials.email || !credentials.password) {
              throw new Error('Email and password are required');
            }
            
            const deviceInfo = await getDeviceInfo();
            const mockUser: User = {
              id: `user-${Date.now()}`,
              email: credentials.email,
              name: credentials.email.split('@')[0],
              createdAt: new Date(),
              updatedAt: new Date(),
              deviceInfo,
              preferences: createDefaultPreferences(),
              stats: createDefaultStats(),
            };
            
            set({
              user: mockUser,
              isAuthenticated: true,
              authToken: `auth-token-${Date.now()}`,
              refreshToken: `refresh-token-${Date.now()}`,
              loading: { auth: false, profile: false, sync: false },
            });
            
            if (__DEV__) {
              console.log('✅ User logged in:', mockUser.email);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            set((state) => ({
              loading: { ...state.loading, auth: false },
            }));
            get().addError(errorMessage);
            throw error;
          }
        },
        
        logoutUser: async () => {
          try {
            // Clear all user data
            set({
              user: null,
              isAuthenticated: false,
              authToken: null,
              refreshToken: null,
              errors: [],
            });
            
            if (__DEV__) {
              console.log('✅ User logged out');
            }
          } catch (error) {
            console.error('❌ Logout error:', error);
          }
        },
        
        updateUserProfile: async (updates) => {
          const currentUser = get().user;
          if (!currentUser) {
            throw new Error('No user logged in');
          }
          
          set((state) => ({
            loading: { ...state.loading, profile: true },
          }));
          
          try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const updatedUser = {
              ...currentUser,
              ...updates,
              updatedAt: new Date(),
            };
            
            set((state) => ({
              user: updatedUser,
              loading: { ...state.loading, profile: false },
            }));
            
            if (__DEV__) {
              console.log('✅ User profile updated');
            }
          } catch (error) {
            set((state) => ({
              loading: { ...state.loading, profile: false },
            }));
            const errorMessage = error instanceof Error ? error.message : 'Profile update failed';
            get().addError(errorMessage);
            throw error;
          }
        },
        
        updatePreferences: async (updates) => {
          const currentUser = get().user;
          if (!currentUser) {
            throw new Error('No user logged in');
          }
          
          try {
            const updatedPreferences = {
              ...currentUser.preferences,
              ...updates,
              notifications: {
                ...currentUser.preferences.notifications,
                ...updates.notifications,
              },
              privacy: {
                ...currentUser.preferences.privacy,
                ...updates.privacy,
              },
              focus: {
                ...currentUser.preferences.focus,
                ...updates.focus,
              },
            };
            
            set((state) => ({
              user: {
                ...currentUser,
                preferences: updatedPreferences,
                updatedAt: new Date(),
              },
            }));
            
            if (__DEV__) {
              console.log('✅ User preferences updated');
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Preferences update failed';
            get().addError(errorMessage);
            throw error;
          }
        },
        
        updateStats: (updates) => {
          const currentUser = get().user;
          if (!currentUser) return;
          
          const updatedStats = {
            ...currentUser.stats,
            ...updates,
            lastActiveDate: new Date(),
          };
          
          set((state) => ({
            user: {
              ...currentUser,
              stats: updatedStats,
              updatedAt: new Date(),
            },
          }));
        },
        
        clearErrors: () => {
          set({ errors: [] });
        },
        
        addError: (error) => {
          set((state) => ({
            errors: [...state.errors, error],
          }));
        },
        
        syncData: async () => {
          set((state) => ({
            loading: { ...state.loading, sync: true },
          }));
          
          try {
            // Simulate sync
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            set((state) => ({
              loading: { ...state.loading, sync: false },
              app: {
                ...state.app,
                lastSyncDate: new Date(),
              },
            }));
            
            if (__DEV__) {
              console.log('✅ Data synced');
            }
          } catch (error) {
            set((state) => ({
              loading: { ...state.loading, sync: false },
            }));
            get().addError('Sync failed');
          }
        },
        
        // Getters
        getUser: () => get().user,
        getPreferences: () => get().user?.preferences || createDefaultPreferences(),
        getStats: () => get().user?.stats || createDefaultStats(),
        isLoggedIn: () => get().isAuthenticated,
        getTheme: () => get().user?.preferences.theme || 'system',
      }),
      {
        name: 'bittersweet-unified-store',
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
          authToken: state.authToken,
          refreshToken: state.refreshToken,
        }),
      }
    ),
    { name: 'bittersweet-store' }
  )
);

// Convenience hooks
export const useUser = () => useUnifiedStore((state) => state.user);
export const useAuth = () => useUnifiedStore((state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  isLoading: state.loading.auth,
  login: state.loginUser,
  logout: state.logoutUser,
}));

export const useSettings = () => useUnifiedStore((state) => ({
  preferences: state.getPreferences(),
  updatePreferences: state.updatePreferences,
  theme: state.getTheme(),
}));

export const useUserStats = () => useUnifiedStore((state) => ({
  stats: state.getStats(),
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
  
  // Initialize with mock data in development if no user is authenticated
  if (process.env.NODE_ENV === 'development') {
    const { autoInitializeUnifiedMockData } = await import('./initializeUnifiedStoreMockData');
    autoInitializeUnifiedMockData();
  }
};

// Export manual initialization function for the unified store
export const loadUnifiedDemoData = async () => {
  try {
    const { initializeUnifiedStoreWithMockData } = await import('./initializeUnifiedStoreMockData');
    return initializeUnifiedStoreWithMockData();
  } catch (error) {
    console.error('❌ Failed to load unified demo data:', error);
    return false;
  }
};