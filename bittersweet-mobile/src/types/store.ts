/**
 * Simplified store type definitions for bittersweet mobile app
 * Removes complex BaseEntity, NormalizedState, and over-engineered abstractions
 * Requirements: 1.1, 1.2, 1.3
 */

// Simple Focus Session Types
export interface FocusSession {
    id: string;
    startTime: Date;
    endTime?: Date;
    duration: number; // actual duration in minutes
    targetDuration: number; // planned duration in minutes
    tagId: string;
    description?: string;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    fruitsEarned: number;
    pauseHistory: PauseRecord[];
    createdAt: Date;
    updatedAt: Date;
}

export interface PauseRecord {
    startTime: Date;
    endTime: Date;
}

export interface Tag {
    id: string;
    name: string;
    icon: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Simple Rewards Types
export interface RewardTransaction {
    id: string;
    type: 'earned' | 'spent';
    amount: number;
    source: 'focus_session' | 'task_completion' | 'streak_bonus' | 'app_unlock' | 'manual';
    description: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}

export interface UnlockableApp {
    id: string;
    name: string;
    bundleId: string;
    icon?: string;
    tagId: string;
    baseCost: number;
    currentCost: number;
    unlockCount: number;
    isBlocked: boolean;
    lastUnlocked?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Simple Settings Types
export interface FocusSettings {
    defaultDuration: number;
    breakDuration: number;
    longBreakDuration: number;
    sessionsUntilLongBreak: number;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    autoStartBreaks: boolean;
    autoStartSessions: boolean;
}

export interface NotificationSettings {
    enabled: boolean;
    sessionReminders: boolean;
    breakReminders: boolean;
    dailyGoals: boolean;
    weeklyReports: boolean;
}

export interface PrivacySettings {
    shareStats: boolean;
    allowFriendRequests: boolean;
    showOnlineStatus: boolean;
}

export interface AppSettings {
    theme: 'light' | 'dark' | 'system';
    language: string;
    notifications: NotificationSettings;
    privacy: PrivacySettings;
    focus: FocusSettings;
}

// Simple Store Slice Interfaces
export interface FocusSlice {
    // State
    currentSession: FocusSession | null;
    sessions: FocusSession[];
    settings: FocusSettings;
    isRunning: boolean;
    timeRemaining: number; // in seconds

    // Actions
    startSession: (params: StartSessionParams) => void;
    pauseSession: () => void;
    resumeSession: () => void;
    completeSession: () => void;
    cancelSession: () => void;

    // Settings
    updateFocusSettings: (updates: Partial<FocusSettings>) => void;
}


export interface RewardsSlice {
    // State
    balance: number;
    totalEarned: number;
    totalSpent: number;
    transactions: RewardTransaction[];
    unlockableApps: UnlockableApp[];

    // Actions
    addFruits: (amount: number, source: string, metadata?: any) => void;
    spendFruits: (amount: number, purpose: string, metadata?: any) => void;
    unlockApp: (appId: string) => boolean;
}

export interface SettingsSlice {
    // State
    settings: AppSettings;

    // Actions
    updateSettings: (updates: Partial<AppSettings>) => void;
    resetSettings: () => void;
}

export interface UISlice {
    // State
    isHydrated: boolean;
    isLoading: boolean;
    errors: string[];

    // Actions
    setHydrated: (hydrated: boolean) => void;
    setLoading: (loading: boolean) => void;
    addError: (error: string) => void;
    clearErrors: () => void;
}

// Root Store Interface
export interface AppStore {
    focus: FocusSlice;
    rewards: RewardsSlice;
    settings: SettingsSlice;
    ui: UISlice;
}

// Action Parameter Types
export interface StartSessionParams {
    targetDuration: number;
    tagId: string;
    description?: string;
}

// Simple Timer State
export interface TimerState {
    startTime: Date | null;
    pausedTime: number; // total paused time in seconds
    isRunning: boolean;
    targetDuration: number; // in minutes
}

// Analytics Types (simplified)
export interface FocusStats {
    totalSessions: number;
    totalFocusTime: number; // in minutes
    averageSessionLength: number;
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    fruitsEarned: number;
    mostProductiveHour: number;
    mostProductiveDay: string;
}

export interface TagStats {
    tagId: string;
    tagName: string;
    sessions: number;
    totalTime: number;
    percentage: number;
}

// Utility Types
export interface TimeRange {
    start: Date;
    end: Date;
}

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Chart Data Types
export interface ChartDataPoint {
    date: Date;
    value: number;
    label: string;
}