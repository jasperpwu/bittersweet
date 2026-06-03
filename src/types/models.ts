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

  isPaused: boolean;
  pausedAt?: Date;
  resumedAt?: Date;
  totalPauseTime: number; // in seconds

  tagId: string; // Required single tag ID for each session

  liveActivityId?: string; // iOS Live Activity ID for timer display
  isManualEntry?: boolean; // Whether the session was added manually without timer
  accelerateMultiplier?: number; // Multiplier applied when fruits were earned (1 = normal, 2 = accelerate active)

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
  isDefault?: boolean; // For built-in tags like 'work', 'study', etc.
  deletedAt?: Date;
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
