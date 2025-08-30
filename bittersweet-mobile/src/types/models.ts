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

// Task Types
export interface Task {
  id: string;
  title: string;
  category: TaskCategory;
  date: Date;
  startTime: Date;
  duration: number; // in minutes
  workingSessions: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  progress: TaskProgress;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface TaskProgress {
  completedSessions: number;
  totalSessions: number;
  timeSpent: number; // in seconds
  isActive: boolean;
  currentSessionType: 'focus' | 'shortBreak' | 'longBreak';
}

// Focus Session Types
export interface FocusSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  targetDuration: number;
  category: string;
  tags: string[];
  description?: string;
  isCompleted: boolean;
  isPaused: boolean;
  pausedAt?: Date;
  resumedAt?: Date;
  totalPauseTime: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isDefault: boolean;
}

export interface SessionTag {
  id: string;
  name: string;
  color: string;
  usageCount: number;
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
  categoryBreakdown: CategoryStats[];
  weeklyProgress: WeeklyStats[];
}

export interface CategoryStats {
  category: string;
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
  category: string;
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