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
  seedsPerMinute: 0.2, // 1 seed per 5 minutes
} as const;

// Session Notes — Instagram-style two-number model: a hard cap on what can be
// written, plus a shorter preview the feeds clamp to before offering "… more".
// `maxLength` is also enforced defensively in clampSessionNotes() (see
// src/utils/textUtils.ts) so a legacy or imported over-length note can never
// reach the cloud — an over-length row would fail its upsert and strand the
// whole session in the sync queue.
export const SESSION_NOTES = {
  maxLength: 500,
  previewLength: 125,
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

// Subscription Product IDs (App Store Connect)
export const SUBSCRIPTION_PRODUCTS = {
  monthly: 'com.path2us.bittersweet.premium.monthly',
  yearly: 'com.path2us.bittersweet.premium.yearly',
} as const;

// Public legal docs (GitHub Pages, source in `public_docs/`). Linked from the
// paywall and Settings, and mirrored in the App Store description — Apple
// checks that all three point at a live page.
export const LEGAL_URLS = {
  terms: 'https://bittersweet-app.github.io/terms.html',
  privacy: 'https://bittersweet-app.github.io/privacy.html',
} as const;

// Landing page for shared referral / Grove invite links (source in
// `public_docs/r.html`). Takes `?c=<code>&t=refer|invite`, tries the deep link,
// and falls back to the App Store. See src/utils/shareLinks.ts for why shared
// links are https rather than the raw `bittersweet-mobile://` scheme.
export const SHARE_LINK_BASE = 'https://bittersweet-app.github.io/r.html';

// Storefront-neutral App Store URL — no `/us/` prefix, so Apple redirects each
// visitor to their own country's store (the app ships in 8+ languages).
export const APP_STORE_URL = 'https://apps.apple.com/app/id6752638348';

// Developer Debug Flags — dev builds only (every flag is AND-ed with `__DEV__`,
// so flipping one on can never leak logging into a release build).
export const DEBUG_FLAGS = {
  // Verbose PostHog SDK logging: every capture + network request, prefixed
  // `[PostHog]`. Turn on to check whether events are captured and whether the
  // POST succeeds (a 401 means a bad key or wrong region/host).
  analytics: false,
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  userData: 'user_data',
  focusSettings: 'focus_settings',
  appSettings: 'app_settings',
  onboardingCompleted: 'onboarding_completed',
  lastSyncTime: 'last_sync_time',
  blocklistTipAcknowledged: 'blocklist_tip_acknowledged',
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
  DEBUG_FLAGS,
  FOCUS_CONSTANTS,
  SESSION_NOTES,
  REWARD_CONSTANTS,
  STORAGE_KEYS,
  THEME_CONSTANTS,
  VALIDATION_CONSTANTS,
  ERROR_MESSAGES,
} as const;