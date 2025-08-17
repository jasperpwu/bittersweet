// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  focus: FocusSettings;
}

export interface NotificationSettings {
  enabled: boolean;
  sessionReminders: boolean;
  breakReminders: boolean;
  dailyGoals: boolean;
  weeklyReports: boolean;
  socialUpdates: boolean;
}

export interface PrivacySettings {
  shareProgress: boolean;
  showOnLeaderboard: boolean;
  allowFriendRequests: boolean;
}

export interface FocusSettings {
  defaultDuration: number;
  breakDuration: number;
  longBreakDuration: number;
  sessionsUntilLongBreak: number;
  autoStartBreaks: boolean;
  strictMode: boolean;
}

// Focus Session Types
export interface FocusSession {
  id: string;
  userId: string;
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
  seedsEarned: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionCategory {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isDefault: boolean;
  userId: string;
}

export interface SessionTag {
  id: string;
  name: string;
  color: string;
  userId: string;
  usageCount: number;
}

// Reward System Types
export interface Reward {
  userId: string;
  seeds: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: Date;
}

export interface RewardTransaction {
  id: string;
  userId: string;
  type: 'earned' | 'spent';
  amount: number;
  source: 'focus_session' | 'challenge_completion' | 'streak_bonus' | 'app_unlock' | 'manual';
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface UnlockableApp {
  id: string;
  name: string;
  bundleId: string;
  icon?: string;
  category: string;
  baseCost: number;
  currentCost: number;
  unlockCount: number;
  isBlocked: boolean;
  lastUnlocked?: Date;
}

// Social Features Types
export interface Squad {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: SquadMember[];
  totalFocusTime: number;
  isPublic: boolean;
  maxMembers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SquadMember {
  id: string;
  userId: string;
  squadId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
  stats: SquadMemberStats;
}

export interface SquadMemberStats {
  focusMinutesToday: number;
  focusMinutesWeek: number;
  focusMinutesMonth: number;
  streak: number;
  rank: number;
  isOnline: boolean;
  lastActive: Date;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  target: number;
  unit: 'minutes' | 'sessions' | 'days' | 'streaks';
  startDate: Date;
  endDate: Date;
  participants: ChallengeParticipant[];
  reward: ChallengeReward;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface ChallengeParticipant {
  id: string;
  userId: string;
  challengeId: string;
  progress: number;
  isCompleted: boolean;
  completedAt?: Date;
  joinedAt: Date;
  user: Pick<User, 'id' | 'name' | 'avatar'>;
}

export interface ChallengeReward {
  seeds: number;
  badge?: string;
  title?: string;
  description?: string;
}

// Analytics Types
export interface FocusStats {
  totalSessions: number;
  totalFocusTime: number; // in minutes
  averageSessionLength: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  seedsEarned: number;
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