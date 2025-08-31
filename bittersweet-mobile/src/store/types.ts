/**
 * Comprehensive TypeScript interfaces and base entity types for unified Zustand store
 * Addresses Requirements: 2.3, 2.4, 3.1, 3.2, 4.1
 */

// Base Entity Types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// Normalized State Structure
export interface NormalizedState<T extends BaseEntity> {
  byId: Record<string, T>;
  allIds: string[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Async State Pattern
export interface AsyncState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

// Store Error Types
export interface StoreError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

// User Types
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  soundEnabled: boolean;
  hapticFeedback: boolean;
  defaultFocusDuration: number;
  autoStartBreaks: boolean;
}

export interface UserStats {
  totalFocusTime: number;
  totalSessions: number;
  currentStreak: number;
  longestStreak: number;
  fruitsEarned: number;
  level: number;
  experience: number;
}

export interface User extends BaseEntity {
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
  stats: UserStats;
}

// Focus Session Types
export interface PauseRecord {
  startTime: Date;
  endTime: Date;
  reason?: string;
}

export interface FocusSession extends BaseEntity {
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  targetDuration: number;
  tagIds: string[];
  notes?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  fruitsEarned: number;
  pauseHistory: PauseRecord[];
}


export interface Tag extends BaseEntity {
  name: string;
  icon: string;
  userId: string;
}

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


// Rewards Types
export interface RewardTransaction extends BaseEntity {
  userId: string;
  amount: number;
  type: 'earned' | 'spent';
  source: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface UnlockableApp extends BaseEntity {
  name: string;
  bundleId: string;
  icon: string;
  cost: number;
  isUnlocked: boolean;
  tagId: string;
  description?: string;
}

// Settings Types
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    enabled: boolean;
    sessionReminders: boolean;
    breakReminders: boolean;
    dailyGoals: boolean;
  };
  privacy: {
    shareStats: boolean;
    allowFriendRequests: boolean;
    showOnlineStatus: boolean;
  };
  focus: FocusSettings;
}

// UI State Types
export interface ModalState {
  isVisible: boolean;
  type?: string;
  data?: any;
}

export interface LoadingState {
  global: boolean;
  actions: Record<string, boolean>;
}

// Store Event Types
export interface StoreEvent {
  type: string;
  payload: any;
  source: keyof RootStore;
  timestamp: Date;
}

// Analytics Types
export interface ChartDataPoint {
  date: Date;
  value: number;
  label?: string;
}

export interface ProductivityInsights {
  bestTimeOfDay: string;
  mostProductiveDay: string;
  averageSessionLength: number;
  completionRate: number;
  weeklyTrend: 'up' | 'down' | 'stable';
  suggestions: string[];
}

export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

// Store Slice Interfaces

export interface FocusSlice {
  // Normalized State
  sessions: NormalizedState<FocusSession>;
  tags: NormalizedState<Tag>;
  
  // Current Session State
  currentSession: {
    session: FocusSession | null;
    isRunning: boolean;
    remainingTime: number;
    startedAt: Date | null;
  };
  
  // Settings
  settings: FocusSettings;
  
  // Actions
  startSession: (params: { targetDuration: number; tagIds: string[]; notes?: string }) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  cancelSession: () => void;
  
  // Tag Management
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;
  
  // Selectors
  getSessionById: (id: string) => FocusSession | undefined;
  getSessionsForDateRange: (start: Date, end: Date) => FocusSession[];
  getTagById: (id: string) => Tag | undefined;
  getActiveSession: () => FocusSession | null;
  
  // Analytics
  getChartData: (period: TimePeriod) => ChartDataPoint[];
  getProductivityInsights: () => ProductivityInsights;
}


export interface RewardsSlice {
  // State
  balance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: NormalizedState<RewardTransaction>;
  unlockableApps: NormalizedState<UnlockableApp>;
  
  // Actions
  earnFruits: (amount: number, source: string, metadata?: any) => void;
  spendFruits: (amount: number, purpose: string, metadata?: any) => void;
  unlockApp: (appId: string) => Promise<boolean>;
  
  // Selectors
  getBalance: () => number;
  getTransactionHistory: () => RewardTransaction[];
  getUnlockableApps: () => UnlockableApp[];
  canAfford: (amount: number) => boolean;
}

export interface SettingsSlice {
  // State
  settings: AppSettings;
  
  // Actions
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  
  // Selectors
  getSettings: () => AppSettings;
  getTheme: () => 'light' | 'dark' | 'system';
}

export interface UISlice {
  // State
  isHydrated: boolean;
  modals: Record<string, ModalState>;
  loading: LoadingState;
  errors: StoreError[];
  
  // Actions
  showModal: (type: string, data?: any) => void;
  hideModal: (type: string) => void;
  setLoading: (action: string, loading: boolean) => void;
  addError: (error: StoreError) => void;
  clearError: (errorId: string) => void;
  clearAllErrors: () => void;
  
  // Selectors
  isModalVisible: (type: string) => boolean;
  getModalData: (type: string) => any;
  isLoading: (action?: string) => boolean;
  getErrors: () => StoreError[];
}

// Root Store Interface
export interface RootStore {
  focus: FocusSlice;
  rewards: RewardsSlice;
  settings: SettingsSlice;
  ui: UISlice;
}

// Store Creator Types
export type StateCreator<T> = (
  set: (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => void,
  get: () => T,
  api: any
) => T;

// Middleware Types
export interface PersistConfig {
  name: string;
  storage: any;
  partialize?: (state: RootStore) => Partial<RootStore>;
  version?: number;
  migrate?: (persistedState: any, version: number) => any;
  onRehydrateStorage?: () => (state?: RootStore) => void;
}

export interface DevtoolsConfig {
  name: string;
  enabled?: boolean;
  serialize?: any;
  actionSanitizer?: (action: any) => any;
}