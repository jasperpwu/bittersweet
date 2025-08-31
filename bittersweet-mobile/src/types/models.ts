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
  targetDuration: number; // in minutes (calculated from startTime to endTime)
  duration: number; // actual duration in minutes (for completed sessions)
  
  // Session state
  status: 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  isPaused: boolean;
  pausedAt?: Date;
  resumedAt?: Date;
  totalPauseTime: number; // in seconds
  
  tagIds: string[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionTag {
  id: string;
  name: string;
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
  tags: string[];
  startTime: Date;
  endTime: Date;
  notes?: string;
}

