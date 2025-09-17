// App Settings Types
export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;
  focus: FocusSettings;
}

export interface NotificationSettings {
  enabled: boolean;
  sessionReminders: boolean;
  breakReminders: boolean;
  dailyGoals: boolean;
}

export interface FocusSettings {
  defaultDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  strictMode: boolean;
}

// Focus Session Types (merged with Task functionality)
export interface FocusSession {
  id: string;
  notes?: string;
  
  // Timing
  startTime: Date;
  endTime: Date; // Now required - end time of the session
  duration: number; // duration in minutes
  
  isPaused: boolean;
  pausedAt?: Date;
  resumedAt?: Date;
  totalPauseTime: number; // in seconds
  
  tagName: string; // Required single tag name for each session
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionTag {
  name: string; // This is now the primary key/identifier
  icon: string;
  usageCount: number;
  isDefault?: boolean; // For built-in tags like 'work', 'study', etc.
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
  tagName: string; // Required single tag name
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

export interface FamilyActivitySelection {
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
  isEnabled: boolean;
  blockedApps: FamilyActivitySelection;
  unlockCostPerMinute: number; // fruits per minute
  maxUnlockDuration: number; // maximum minutes per unlock session
  allowedUnlocksPerDay: number;
  scheduleEnabled: boolean;
  blockingSchedule?: {
    startTime: string; // HH:mm format
    endTime: string; // HH:mm format
    daysOfWeek: number[]; // 0-6, Sunday = 0
  };
}

