import type { ActivityType, RatingSource, MotionSnapshot } from '../utils/focusRating';

// App Settings Types
export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;
  focus: FocusSettings;
}

export interface NotificationSettings {
  enabled: boolean;
}

export interface FocusSettings {
  defaultDuration: number;
  timerPickerStyle?: 'scroller' | 'wheel';
}

// Focus Session Types (merged with Task functionality)
export interface FocusSession {
  id: string;
  notes?: string;
  photoUrl?: string;

  // Timing
  startTime: Date;
  endTime: Date; // Now required - end time of the session
  duration: number; // adjusted duration in minutes, kept for existing analytics/UI
  initialSetDuration?: number; // originally selected duration in minutes
  actualDuration?: number; // elapsed duration in minutes before user adjustment
  adjustedDuration?: number; // user-adjusted duration in minutes

  tagId: string; // Required single tag ID for each session
  secondaryTagId?: string; // Optional second tag for dual-activity sessions (e.g. workout + audiobook)

  liveActivityId?: string; // iOS Live Activity ID for timer display
  isManualEntry?: boolean; // Whether the session was added manually without timer
  accelerateMultiplier?: number; // Multiplier applied when fruits were earned (1 = normal, 2 = accelerate active)

  // Motion-based focus rating
  focusRating?: number; // 1–5, suggested from motion or set by the user
  ratingSource?: RatingSource; // who set focusRating
  baseFruits?: number; // fruits earned before the rating discount
  awardedFruits?: number; // fruits actually credited after the rating discount
  motionSummary?: MotionSnapshot; // on-device motion estimate, for the insights sheet

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionTag {
  id: string; // Stable unique identifier
  name: string;
  icon: string;
  color: string; // Hex color string like '#6592E9'
  usageCount: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;

  // Shared tag fields
  isSharing?: boolean; // TRUE on owner's tag when actively shared
  sharedFromTagId?: string; // Set on joiner's tag, references owner's tag ID
  sharedFromUserId?: string; // Set on joiner's tag, references owner's user ID
  sharedOwnerName?: string; // Cached owner display name on joiner's tag

  // Optional hint for motion-based focus rating. Unset is treated as 'stationary'.
  activityType?: ActivityType;
}

// Analytics Types
export interface FocusStats {
  totalSessions: number;
  totalFocusTime: number; // in minutes
  averageSessionLength: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  mostProductiveHour: number;
  mostProductiveDay: string;
  tagBreakdown: TagStats[];
  weeklyProgress: WeeklyStats[];
}

export interface TagStats {
  tag: string;
  sessions: number;
  totalTime: number;
  percentage: number;
}

export interface WeeklyStats {
  week: string;
  sessions: number;
  totalTime: number;
  completionRate: number;
}

// Screen Time Types
export interface ScreenTimeData {
  date: Date;
  totalScreenTime: number; // in minutes
  appUsage: AppUsageData[];
  pickups: number;
  notifications: number;
  firstPickup?: Date;
  lastUsage?: Date;
}

export interface AppUsageData {
  bundleId: string;
  name: string;
  tagIds: string[];
  timeSpent: number; // in minutes
  opens: number;
  notifications: number;
  icon?: string;
}

// Common Types
export interface TimeRange {
  start: Date;
  end: Date;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Input types for creating sessions
export interface CreateSessionInput {
  tagId: string; // Required single tag ID
  startTime: Date;
  endTime: Date;
  notes?: string;
}

// Blocklist Types for Family Controls Integration
export interface FamilyActivityToken {
  id: string;
  bundleIdentifier: string;
  displayName: string;
  iconData?: string;
}

// Updated to match react-native-device-activity library format (string token)
export type FamilyActivitySelection = string;

// Legacy format for display purposes
export interface FamilyActivitySelectionLegacy {
  applicationTokens: FamilyActivityToken[];
  categoryTokens: FamilyActivityToken[];
  webDomainTokens: FamilyActivityToken[];
}

export interface UnlockSession {
  id: string;
  appTokens: FamilyActivityToken[];
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
  cost: number; // fruits spent
  isActive: boolean;
  remainingTime?: number; // in seconds
  liveActivityId?: string; // iOS Live Activity ID for countdown display
  notificationId?: string; // scheduled unlock expiration notification
}

export interface UnlockTransaction {
  id: string;
  sessionId: string;
  appTokens: FamilyActivityToken[];
  duration: number; // in minutes
  cost: number; // fruits spent
  timestamp: Date;
  status: 'completed' | 'cancelled' | 'expired';
}

// A fruit-store purchase (accelerate card, usage tip, slider theme, custom
// reward, ...). Synced to the `purchases` table as a list entity. tipId is set
// for usage-tip purchases and records which tip was delivered, so future tip
// purchases avoid repeats. Slider themes encode their theme id in the productId
// itself (`theme_<id>`, see config/sliderThemes.ts) and custom rewards likewise
// (`custom_<id>`, see config/customRewards.ts) — ownership derives from history.
// Rows are mostly write-once, but photoUrl can be set after the fact (per-row
// LWW on updatedAt carries the edit through sync).
export interface Purchase {
  id: string;
  productId: 'accelerate_card' | 'usage_tip' | `theme_${string}` | `custom_${string}`;
  cost: number; // fruits spent
  tipId?: string;
  // Photo the user attached to a bought custom reward: local file:// path
  // until the Storage upload succeeds, then the public bucket URL.
  photoUrl?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

// A user-defined fruit-store reward (Custom tab): name + cost + optional emoji.
// Synced to the `custom_rewards` table as a list entity (per-row LWW, soft
// delete). The definition stays in the store after purchase — the catalog
// filters out bought ones (ownership derives from purchase history, like
// themes), while history rows keep resolving their name/emoji from here.
export interface CustomReward {
  id: string;
  name: string;
  emoji?: string;
  cost: number; // fruits
  createdAt: string; // ISO
  updatedAt: string; // ISO
  deletedAt?: string; // ISO
}

export interface BlocklistSettings {
  blockedApps: FamilyActivitySelectionLegacy; // Use legacy format for storage/display
  unlockCostPerMinute: number; // fruits per minute
  scheduleEnabled: boolean;
  blockingSchedule?: {
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
    daysOfWeek: number[]; // 0-6, Sunday = 0
  };
}
