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
    categoryId: string;
    description?: string;
    status: 'active' | 'paused' | 'completed' | 'cancelled';
    seedsEarned: number;
    pauseHistory: PauseRecord[];
    createdAt: Date;
    updatedAt: Date;
}

export interface PauseRecord {
    startTime: Date;
    endTime: Date;
}

export interface Category {
    id: string;
    name: string;
    color: string;
    icon: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Simple Task Types
export interface Task {
    id: string;
    title: string;
    description?: string;
    categoryId: string;
    date: Date;
    startTime: Date;
    duration: number; // in minutes
    status: 'scheduled' | 'active' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high';
    focusTimeSpent: number; // in minutes
    estimatedTime: number; // in minutes
    completed: boolean;
    completedAt?: Date;
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
    category: string;
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
    categories: Category[];
    settings: FocusSettings;
    isRunning: boolean;
    timeRemaining: number; // in seconds

    // Actions
    startSession: (params: StartSessionParams) => void;
    pauseSession: () => void;
    resumeSession: () => void;
    completeSession: () => void;
    cancelSession: () => void;

    // Category Management
    addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void;
    updateCategory: (id: string, updates: Partial<Category>) => void;
    deleteCategory: (id: string) => void;

    // Settings
    updateFocusSettings: (updates: Partial<FocusSettings>) => void;
}

export interface TasksSlice {
    // State
    tasks: Task[];
    selectedDate: Date;

    // Actions
    createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'focusTimeSpent' | 'completed' | 'completedAt'>) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    completeTask: (id: string) => void;
    setSelectedDate: (date: Date) => void;
}

export interface RewardsSlice {
    // State
    balance: number;
    totalEarned: number;
    totalSpent: number;
    transactions: RewardTransaction[];
    unlockableApps: UnlockableApp[];

    // Actions
    addSeeds: (amount: number, source: string, metadata?: any) => void;
    spendSeeds: (amount: number, purpose: string, metadata?: any) => void;
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
    tasks: TasksSlice;
    rewards: RewardsSlice;
    settings: SettingsSlice;
    ui: UISlice;
}

// Action Parameter Types
export interface StartSessionParams {
    targetDuration: number;
    categoryId: string;
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
    seedsEarned: number;
    mostProductiveHour: number;
    mostProductiveDay: string;
}

export interface CategoryStats {
    categoryId: string;
    categoryName: string;
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