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
  seedsEarned: number;
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
  categoryId: string;
  tagIds: string[];
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  seedsEarned: number;
  pauseHistory: PauseRecord[];
}

export interface Category extends BaseEntity {
  name: string;
  color: string;
  icon: string;
  isDefault: boolean;
  userId: string;
}

export interface Tag extends BaseEntity {
  name: string;
  color: string;
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

// Task Types
export interface TaskProgress {
  completed: boolean;
  completedAt?: Date;
  focusTimeSpent: number;
  estimatedTime: number;
  actualTime: number;
}

export interface Task extends BaseEntity {
  title: string;
  description?: string;
  categoryId: string;
  date: Date;
  startTime: Date;
  duration: number;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  progress: TaskProgress;
  focusSessionIds: string[];
  priority: 'low' | 'medium' | 'high';
  userId: string;
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
  category: string;
  description?: string;
}

// Social Types
export interface SquadMember {
  userId: string;
  joinedAt: Date;
  role: 'member' | 'admin' | 'owner';
  stats: {
    totalFocusTime: number;
    weeklyFocusTime: number;
    currentStreak: number;
  };
}

export interface Squad extends BaseEntity {
  name: string;
  description?: string;
  icon: string;
  isPrivate: boolean;
  inviteCode: string;
  ownerId: string;
  members: Record<string, SquadMember>;
  memberIds: string[];
  maxMembers: number;
  stats: {
    totalFocusTime: number;
    totalSessions: number;
    averageSessionLength: number;
  };
}

export interface Challenge extends BaseEntity {
  title: string;
  description: string;
  type: 'individual' | 'squad';
  targetType: 'duration' | 'sessions' | 'streak';
  targetValue: number;
  startDate: Date;
  endDate: Date;
  participants: string[];
  rewards: {
    seeds: number;
    badges?: string[];
  };
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
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
    squadUpdates: boolean;
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
export interface AuthSlice {
  // State
  user: User | null;
  isAuthenticated: boolean;
  authToken: string | null;
  refreshToken: string | null;
  loginState: AsyncState<User>;
  
  // Actions
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  
  // Selectors
  getUser: () => User | null;
  isLoggedIn: () => boolean;
}

export interface FocusSlice {
  // Normalized State
  sessions: NormalizedState<FocusSession>;
  categories: NormalizedState<Category>;
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
  startSession: (params: { targetDuration: number; categoryId: string; tagIds: string[]; description?: string }) => void;
  pauseSession: () => void;
  resumeSession: () => void;
  completeSession: () => void;
  cancelSession: () => void;
  
  // Category/Tag Management
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  
  // Selectors
  getSessionById: (id: string) => FocusSession | undefined;
  getSessionsForDateRange: (start: Date, end: Date) => FocusSession[];
  getCategoryById: (id: string) => Category | undefined;
  getActiveSession: () => FocusSession | null;
  
  // Analytics
  getChartData: (period: TimePeriod) => ChartDataPoint[];
  getProductivityInsights: () => ProductivityInsights;
}

export interface TasksSlice {
  // Normalized State
  tasks: NormalizedState<Task>;
  
  // UI State
  selectedDate: Date;
  viewMode: 'day' | 'week' | 'month';
  currentWeekStart: Date;
  
  // Actions
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'progress' | 'focusSessionIds'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  startTask: (id: string) => void;
  completeTask: (id: string) => void;
  
  // UI Actions
  setSelectedDate: (date: Date) => void;
  setViewMode: (mode: 'day' | 'week' | 'month') => void;
  
  // Week Navigation Actions
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  
  // Selectors
  getTaskById: (id: string) => Task | undefined;
  getTasksForDate: (date: Date) => Task[];
  getActiveTask: () => Task | null;
  getTasksForDateRange: (start: Date, end: Date) => Task[];
  
  // Integration with Focus
  linkTaskToSession: (taskId: string, sessionId: string) => void;
  getTaskProgress: (id: string) => TaskProgress;
}

export interface RewardsSlice {
  // State
  balance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: NormalizedState<RewardTransaction>;
  unlockableApps: NormalizedState<UnlockableApp>;
  
  // Actions
  earnSeeds: (amount: number, source: string, metadata?: any) => void;
  spendSeeds: (amount: number, purpose: string, metadata?: any) => void;
  unlockApp: (appId: string) => Promise<boolean>;
  
  // Selectors
  getBalance: () => number;
  getTransactionHistory: () => RewardTransaction[];
  getUnlockableApps: () => UnlockableApp[];
  canAfford: (amount: number) => boolean;
}

export interface SocialSlice {
  // State
  squads: NormalizedState<Squad>;
  challenges: NormalizedState<Challenge>;
  friends: NormalizedState<User>;
  
  // Current User's Social Data
  userSquads: string[];
  activeChallenges: string[];
  
  // Actions
  joinSquad: (squadId: string) => Promise<void>;
  leaveSquad: (squadId: string) => Promise<void>;
  createChallenge: (challenge: Omit<Challenge, 'id' | 'createdAt' | 'updatedAt' | 'participants'>) => Promise<void>;
  joinChallenge: (challengeId: string) => Promise<void>;
  
  // Selectors
  getUserSquads: () => Squad[];
  getActiveChallenges: () => Challenge[];
  getSquadLeaderboard: (squadId: string) => SquadMember[];
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
  auth: AuthSlice;
  focus: FocusSlice;
  tasks: TasksSlice;
  rewards: RewardsSlice;
  social: SocialSlice;
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