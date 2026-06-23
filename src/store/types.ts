/**
 * Comprehensive TypeScript interfaces and base entity types for unified Zustand store
 * Addresses Requirements: 2.3, 2.4, 3.1, 3.2, 4.1
 */

import type { ActivityType, RatingSource, MotionSnapshot } from '../utils/focusRating';

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
  tagId: string;
  secondaryTagId?: string; // Optional second tag for dual-activity sessions
  notes?: string;
  fruitsEarned: number;
  pauseHistory: PauseRecord[];
  // --- Motion-based focus rating ---
  focusRating?: number; // 1–5, suggested from motion or set by the user
  ratingSource?: RatingSource; // who set focusRating
  baseFruits?: number; // fruits earned before the rating discount
  awardedFruits?: number; // fruits actually credited after the rating discount
  motionSummary?: MotionSnapshot; // on-device motion estimate, for the insights sheet
}

export interface Tag extends BaseEntity {
  name: string;
  icon: string;
  userId: string;
  sortOrder: number;
  deletedAt?: Date;
  // Optional hint for motion-based focus rating. Unset is treated as 'stationary'.
  activityType?: ActivityType;
}

export interface TargetHistoryEntry {
  effectiveDate: string; // "YYYY-MM-DD" — changes apply from this date onward
  period: 'daily' | 'weekly' | 'monthly';
  targetMinutes: number;
  restDayTargetMinutes: number;
  restDays: number[]; // which days (0=Sun..6=Sat) were rest days at this point
}

export interface FocusGoal extends BaseEntity {
  userId: string;
  customName?: string; // if empty/undefined, derive from tag
  tagId: string; // 1:1 with tag
  activePeriod: 'daily' | 'weekly' | 'monthly' | 'none';
  dailyTargetMinutes: number; // 0 = not configured
  dailyRestDayTargetMinutes: number;
  weeklyTargetMinutes: number;
  monthlyTargetMinutes: number;
  // Cumulative lifetime target for 'none' (no-period) goals — counts all sessions
  // for the tag, never resets. 0 = not configured.
  totalTargetMinutes: number;
  targetHistory: TargetHistoryEntry[];
  isActive: boolean;
  isRepeating: boolean;
  showTotalHours: boolean;
  currentProgress: number;
  lastResetDate: Date;
  sortOrder: number;
}

export interface Badge extends BaseEntity {
  goalId?: string;
  tagIcon: string;
  tagName: string;
  tagColor: string;
  goalName: string;
  totalMinutes: number;
  totalSessions: number;
  dailyStats?: { longestStreak: number; periodsGoalMet: number; totalPeriods: number };
  weeklyStats?: { longestStreak: number; periodsGoalMet: number; totalPeriods: number };
  monthlyStats?: { longestStreak: number; periodsGoalMet: number; totalPeriods: number };
  durationDistribution: {
    avgMinutesPerSession: number;
    shortestSession: number;
    longestSession: number;
    peakHour: number;
    peakDay: string;
  };
  notesCount: number;
  recentNotes: string[];
  startDate: string;
  endDate: string;
}

// --- AI Focus Coach ---
// A weekly, deterministically-scored report. Stats + score are computed in code
// (always correct/explainable); only the insight `cards` prose is "narrated" — by
// Apple's on-device model when available, otherwise by a templated fallback.

// The fixed set of in-app actions an insight card can deep-link to. The narrator
// only ever *picks* from this enum (constrained generation), so it can never invent
// an action the app can't perform; the engine fills the params.
// `none` renders the insight as an info bullet (no button). The rest deep-link into
// a real in-app flow.
export type CoachActionType =
  | 'create_goal' // open the goal config sheet, prefilled for a tag
  | 'adjust_goal' // open the goal config sheet for an existing goal
  | 'open_goals' // dismiss the coach and go to the Goals tab
  | 'block_apps' // open the app-selection (Family Controls) modal
  | 'link_health' // open Apple Health settings to link workout tracking
  | 'enable_notifications' // request OS notification permission / open iOS Settings
  | 'enable_goal_reminders' // toggle the in-app goal-reminder preference on
  | 'none';

export interface CoachAction {
  type: CoachActionType;
  label?: string; // button text, e.g. "Set a Reading goal"
  // Deep-link params (all optional; populated by the engine, never the model).
  tagId?: string;
  goalId?: string;
  period?: 'daily' | 'weekly' | 'monthly';
  targetMinutes?: number;
}

export type CoachInsightSeverity = 'positive' | 'neutral' | 'attention';

export interface CoachInsightCard {
  id: string;
  headline: string;
  body: string;
  severity: CoachInsightSeverity;
  action: CoachAction;
}

export interface CoachTagStat {
  tagId: string;
  minutes: number;
  sessions: number;
  avgRating: number | null; // null when no rated sessions for this tag
}

// The deterministic "facts" the score is built from and the narrator is handed.
export interface CoachWeeklyStats {
  totalMinutes: number;
  totalSessions: number;
  activeDays: number; // distinct days with >=1 session
  avgRating: number | null; // mean focusRating across rated sessions, null if none
  ratedCount: number;
  peakHour: number | null; // 0–23, null if no sessions
  peakDay: string | null; // 'Monday'… null if no sessions
  trailingAvgMinutes: number; // user's own trailing 4-week average
  deltaMinutesVsTrailingAvg: number; // thisWeekMinutes − trailingAvgMinutes
  byTag: CoachTagStat[];
  goalsTracked: number; // active goals during the week
  goalsMet: number; // goals whose weekly-equivalent target was met
}

export interface CoachSubScores {
  consistency: number; // 0–100
  quality: number; // 0–100
  volume: number; // 0–100
}

export type CoachNarrator = 'apple_fm' | 'template';

export interface WeeklyCoachReport extends BaseEntity {
  // id = `coach-<weekStartISODate>` — deterministic per week, so re-generation is idempotent.
  weekStart: Date;
  weekEnd: Date;
  focusScore: number; // 0–100
  subScores: CoachSubScores;
  stats: CoachWeeklyStats;
  cards: CoachInsightCard[];
  narrator: CoachNarrator;
  generatedAt: Date;
  deletedAt?: Date;
}

export interface FocusSettings {
  defaultDuration: number;
  timerPickerStyle?: 'scroller' | 'wheel';
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
  hasSeenOnboarding: boolean;
  hasSeenFruitCoachMark: boolean;
  hasSeenTagSwipeHint: boolean;
  hasSeenGoalSwipeHint: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    enabled: boolean;
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
export interface ChartSegment {
  tagName: string;
  value: number; // minutes
  color: string;
}

export interface ChartDataPoint {
  date: Date;
  value: number;
  label?: string;
  segments?: ChartSegment[];
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
  goals: NormalizedState<FocusGoal>;

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
  startSession: (params: { targetDuration: number; tagId: string; notes?: string }) => void;
  completeSession: () => void;

  // Tag Management
  addTag: (tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTag: (id: string, updates: Partial<Tag>) => void;
  deleteTag: (id: string) => void;

  // Goal Management
  updateGoal: (id: string, updates: Partial<FocusGoal>) => void;
  deleteGoal: (id: string) => void;
  concludeGoal: (id: string) => void;
  deleteBadge: (id: string) => void;
  updateGoalProgress: (goalId: string, minutesToAdd: number) => void;

  // Selectors
  getSessionById: (id: string) => FocusSession | undefined;
  getSessionsForDateRange: (start: Date, end: Date) => FocusSession[];
  getTagById: (id: string) => Tag | undefined;
  getActiveSession: () => FocusSession | null;
  getGoalById: (id: string) => FocusGoal | undefined;
  getActiveGoals: () => FocusGoal[];

  // Analytics
  getChartData: (period: TimePeriod) => ChartDataPoint[];
  getProductivityInsights: () => ProductivityInsights;
}

export interface RewardsSlice {
  // State
  balance: number;
  totalEarned: number;
  totalSpent: number;
  unlockableApps: NormalizedState<UnlockableApp>;

  // Actions
  earnFruits: (amount: number, source: string, metadata?: any) => void;
  spendFruits: (amount: number, purpose: string, metadata?: any) => void;
  unlockApp: (appId: string) => Promise<boolean>;

  // Selectors
  getBalance: () => number;
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
