// App Configuration Constants
export const APP_CONFIG = {
  name: 'bittersweet',
  version: '1.0.0',
  description: 'Mindful screen time management and focus habit building',
  website: 'https://bittersweet.app',
  supportEmail: 'support@bittersweet.app',
} as const;

// API Configuration
export const API_CONFIG = {
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://api.bittersweet.app',
  timeout: 10000, // 10 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
} as const;

// Focus Session Constants
export const FOCUS_CONSTANTS = {
  defaultDuration: 25, // minutes
  minDuration: 5, // minutes
  maxDuration: 120, // minutes
  breakDuration: 5, // minutes
  longBreakDuration: 15, // minutes
  sessionsUntilLongBreak: 4,
  seedsPerMinute: 0.2, // 1 seed per 5 minutes
} as const;

// Reward System Constants
export const REWARD_CONSTANTS = {
  initialSeeds: 0,
  maxSeeds: 999999,
  baseUnlockCost: 10,
  costMultiplier: 1.5,
  streakBonus: {
    3: 5, // 5 seeds for 3-day streak
    7: 15, // 15 seeds for 7-day streak
    14: 30, // 30 seeds for 14-day streak
    30: 75, // 75 seeds for 30-day streak
  },
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  authToken: 'auth_token',
  refreshToken: 'refresh_token',
  userData: 'user_data',
  focusSettings: 'focus_settings',
  appSettings: 'app_settings',
  onboardingCompleted: 'onboarding_completed',
  lastSyncTime: 'last_sync_time',
} as const;

// Theme Constants
export const THEME_CONSTANTS = {
  borderRadius: {
    small: 8,
    medium: 12,
    large: 16,
    xl: 20,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
    '5xl': 48,
  },
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    lg: 16,
    xl: 18,
    '2xl': 20,
    '3xl': 24,
  },
} as const;

// Validation Constants
export const VALIDATION_CONSTANTS = {
  email: {
    minLength: 5,
    maxLength: 254,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false,
  },
  name: {
    minLength: 2,
    maxLength: 50,
    pattern: /^[a-zA-Z\s'-]+$/,
  },
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  network: 'Network error. Please check your connection.',
  unauthorized: 'Session expired. Please log in again.',
  forbidden: 'You do not have permission to perform this action.',
  notFound: 'The requested resource was not found.',
  serverError: 'Server error. Please try again later.',
  validation: 'Please check your input and try again.',
  unknown: 'An unexpected error occurred.',
} as const;

// Export all constants
export const constants = {
  APP_CONFIG,
  API_CONFIG,
  FOCUS_CONSTANTS,
  REWARD_CONSTANTS,
  STORAGE_KEYS,
  THEME_CONSTANTS,
  VALIDATION_CONSTANTS,
  ERROR_MESSAGES,
} as const;