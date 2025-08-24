/**
 * Settings slice with comprehensive user preferences and persistence
 * Addresses Requirements: 2.2, 5.1, 5.2, 5.3, 6.2, 7.4, 8.2, 9.1
 */

import { SettingsSlice, AppSettings } from '../types';
import { createEventEmitter, STORE_EVENTS } from '../utils/eventBus';

const defaultSettings: AppSettings = {
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
};

export function createSettingsSlice(set: any, get: any, api: any): SettingsSlice {
  const eventEmitter = createEventEmitter('settings');

  return {
    // State
    settings: defaultSettings,
    
    // Actions
    updateSettings: (updates: Partial<AppSettings>) => {
      const currentSettings = get().settings.settings;
      const previousTheme = currentSettings.theme;
      
      set((state: any) => {
        // Deep merge settings
        state.settings.settings = {
          ...currentSettings,
          ...updates,
          notifications: {
            ...currentSettings.notifications,
            ...updates.notifications,
          },
          privacy: {
            ...currentSettings.privacy,
            ...updates.privacy,
          },
          focus: {
            ...currentSettings.focus,
            ...updates.focus,
          },
        };
      });

      // Emit general settings updated event
      eventEmitter.emit(STORE_EVENTS.SETTINGS_UPDATED, {
        updates,
        previousSettings: currentSettings,
        newSettings: get().settings.settings,
      });

      // Emit specific theme change event if theme was updated
      if (updates.theme && updates.theme !== previousTheme) {
        eventEmitter.emit(STORE_EVENTS.THEME_CHANGED, {
          previousTheme,
          newTheme: updates.theme,
        });
      }

      // Update focus slice settings if focus settings were changed
      if (updates.focus) {
        const focusSlice = get().focus;
        if (focusSlice && typeof focusSlice.updateSettings === 'function') {
          focusSlice.updateSettings(updates.focus);
        }
      }
    },

    resetSettings: () => {
      const currentSettings = get().settings.settings;
      
      set((state: any) => {
        state.settings.settings = { ...defaultSettings };
      });

      // Emit settings reset event
      eventEmitter.emit(STORE_EVENTS.SETTINGS_UPDATED, {
        updates: defaultSettings,
        previousSettings: currentSettings,
        newSettings: defaultSettings,
        isReset: true,
      });

      // Emit theme change event if theme changed
      if (currentSettings.theme !== defaultSettings.theme) {
        eventEmitter.emit(STORE_EVENTS.THEME_CHANGED, {
          previousTheme: currentSettings.theme,
          newTheme: defaultSettings.theme,
        });
      }
    },
    
    // Selectors
    getSettings: () => get().settings.settings,
    
    getTheme: () => get().settings.settings.theme,
  };
}