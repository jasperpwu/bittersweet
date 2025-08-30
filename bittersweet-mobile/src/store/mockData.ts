/**
 * Mock data for testing and development
 * Provides a complete set of realistic test data to showcase all features
 */

import { generateId, generateUUID } from './utils/idGenerator';
import type { 
  User, 
  FocusSession, 
  Category as FocusCategory, 
  Tag as FocusTag, 
  Task, 
  RewardTransaction,
  UserStats,
  UserPreferences,
  FocusSettings,
  TaskProgress
} from './types';

// Mock user ID for consistency
const MOCK_USER_ID = 'test-user-123';

// Helper function to generate dates
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

export const mockUser: User = {
  id: MOCK_USER_ID,
  email: 'demo@bittersweet.app',
  name: 'Demo User',
  avatar: undefined,
  createdAt: daysAgo(30),
  updatedAt: new Date(),
  preferences: {
    theme: 'light' as const,
    notifications: true,
    soundEnabled: true,
    hapticFeedback: true,
    defaultFocusDuration: 25,
    autoStartBreaks: false,
  } as UserPreferences,
  stats: {
    totalFocusTime: 1125,
    totalSessions: 45,
    currentStreak: 7,
    longestStreak: 12,
    seedsEarned: 2250,
    level: 5,
    experience: 1125,
  } as UserStats,
};

export const mockFocusCategories: FocusCategory[] = [
  {
    id: 'cat-work',
    name: 'Work',
    color: '#3B82F6',
    icon: 'briefcase',
    isDefault: true,
    userId: MOCK_USER_ID,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(5),
  },
  {
    id: 'cat-study',
    name: 'Study',
    color: '#10B981',
    icon: 'book',
    isDefault: true,
    userId: MOCK_USER_ID,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(10),
  },
  {
    id: 'cat-personal',
    name: 'Personal',
    color: '#F59E0B',
    icon: 'person',
    isDefault: false,
    userId: MOCK_USER_ID,
    createdAt: daysAgo(25),
    updatedAt: daysAgo(3),
  },
  {
    id: 'cat-creative',
    name: 'Creative',
    color: '#EF4444',
    icon: 'color-palette',
    isDefault: false,
    userId: MOCK_USER_ID,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(1),
  },
];

export const mockFocusTags: FocusTag[] = [
  { 
    id: 'tag-deep', 
    name: 'Deep Work', 
    color: '#8B5CF6', 
    userId: MOCK_USER_ID,
    createdAt: daysAgo(30),
    updatedAt: daysAgo(5),
  },
  { 
    id: 'tag-urgent', 
    name: 'Urgent', 
    color: '#EF4444', 
    userId: MOCK_USER_ID,
    createdAt: daysAgo(25),
    updatedAt: daysAgo(3),
  },
  { 
    id: 'tag-learning', 
    name: 'Learning', 
    color: '#10B981', 
    userId: MOCK_USER_ID,
    createdAt: daysAgo(20),
    updatedAt: daysAgo(2),
  },
  { 
    id: 'tag-review', 
    name: 'Review', 
    color: '#F59E0B', 
    userId: MOCK_USER_ID,
    createdAt: daysAgo(15),
    updatedAt: daysAgo(1),
  },
  { 
    id: 'tag-planning', 
    name: 'Planning', 
    color: '#6B7280', 
    userId: MOCK_USER_ID,
    createdAt: daysAgo(10),
    updatedAt: new Date(),
  },
];

export const mockFocusSessions: FocusSession[] = [
  // Recent completed sessions
  {
    id: generateId(),
    userId: MOCK_USER_ID,
    categoryId: 'cat-work',
    tagIds: ['tag-deep'],
    targetDuration: 25,
    duration: 25,
    status: 'completed' as const,
    startTime: hoursAgo(2),
    endTime: hoursAgo(1.5),
    description: 'Working on quarterly planning',
    seedsEarned: 50,
    pauseHistory: [],
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(1.5),
  },
  {
    id: generateId(),
    userId: MOCK_USER_ID,
    categoryId: 'cat-study',
    tagIds: ['tag-learning'],
    targetDuration: 30,
    duration: 28,
    status: 'completed' as const,
    startTime: daysAgo(1),
    endTime: daysAgo(1),
    description: 'React Native documentation',
    seedsEarned: 56,
    pauseHistory: [],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  // More historical sessions for analytics
  ...Array.from({ length: 15 }, (_, i) => ({
    id: generateId(),
    userId: MOCK_USER_ID,
    categoryId: ['cat-work', 'cat-study', 'cat-personal', 'cat-creative'][i % 4],
    tagIds: [['tag-deep'], ['tag-learning'], ['tag-planning'], ['tag-review']][i % 4],
    targetDuration: [25, 30, 20, 45][i % 4],
    duration: [25, 28, 20, 43][i % 4],
    status: 'completed' as const,
    startTime: daysAgo(i + 2),
    endTime: daysAgo(i + 2),
    description: `Session ${i + 1}`,
    seedsEarned: [25, 28, 20, 43][i % 4] * 2,
    pauseHistory: [],
    createdAt: daysAgo(i + 2),
    updatedAt: daysAgo(i + 2),
  })),
];

export const mockTasks: Task[] = [
  {
    id: generateId(),
    title: 'Complete project proposal',
    description: 'Finish the Q4 project proposal with timeline and budget',
    categoryId: 'cat-work',
    userId: MOCK_USER_ID,
    status: 'scheduled' as const,
    priority: 'high' as const,
    date: new Date(),
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    duration: 60,
    progress: {
      completed: false,
      focusTimeSpent: 0,
      estimatedTime: 60,
      actualTime: 0,
    } as TaskProgress,
    focusSessionIds: [],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
  },
  {
    id: generateId(),
    title: 'Study React Hooks',
    description: 'Deep dive into useCallback and useMemo optimization',
    categoryId: 'cat-study',
    userId: MOCK_USER_ID,
    status: 'active' as const,
    priority: 'medium' as const,
    date: new Date(),
    startTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
    duration: 45,
    progress: {
      completed: false,
      focusTimeSpent: 27,
      estimatedTime: 45,
      actualTime: 27,
    } as TaskProgress,
    focusSessionIds: [generateId()],
    createdAt: daysAgo(3),
    updatedAt: hoursAgo(1),
  },
  {
    id: generateId(),
    title: 'Plan weekend trip',
    description: 'Research destinations and book accommodation',
    categoryId: 'cat-personal',
    userId: MOCK_USER_ID,
    status: 'completed' as const,
    priority: 'low' as const,
    date: daysAgo(1),
    startTime: daysAgo(1),
    duration: 30,
    progress: {
      completed: true,
      completedAt: daysAgo(1),
      focusTimeSpent: 30,
      estimatedTime: 30,
      actualTime: 30,
    } as TaskProgress,
    focusSessionIds: [generateId()],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
  },
  {
    id: generateId(),
    title: 'Design new logo',
    description: 'Create multiple concepts for client review',
    categoryId: 'cat-creative',
    userId: MOCK_USER_ID,
    status: 'scheduled' as const,
    priority: 'medium' as const,
    date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    duration: 90,
    progress: {
      completed: false,
      focusTimeSpent: 0,
      estimatedTime: 90,
      actualTime: 0,
    } as TaskProgress,
    focusSessionIds: [],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
];

export const mockRewardTransactions: RewardTransaction[] = [
  {
    id: generateId(),
    userId: MOCK_USER_ID,
    type: 'earned' as const,
    amount: 50,
    description: 'Completed 25-minute focus session',
    source: 'focus_session',
    metadata: { sessionId: generateId(), duration: 25 },
    createdAt: hoursAgo(2),
    updatedAt: hoursAgo(2),
  },
  {
    id: generateId(),
    userId: MOCK_USER_ID,
    type: 'earned' as const,
    amount: 56,
    description: 'Completed 28-minute study session',
    source: 'focus_session',
    metadata: { sessionId: generateId(), duration: 28 },
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
  },
  {
    id: generateId(),
    userId: MOCK_USER_ID,
    type: 'earned' as const,
    amount: 100,
    description: 'Weekly streak bonus',
    source: 'streak_bonus',
    metadata: { streakLength: 7 },
    createdAt: daysAgo(3),
    updatedAt: daysAgo(3),
  },
  {
    id: generateId(),
    userId: MOCK_USER_ID,
    type: 'spent' as const,
    amount: 200,
    description: 'Unlocked Instagram for 30 minutes',
    source: 'app_unlock',
    metadata: { appId: 'instagram', duration: 30 },
    createdAt: daysAgo(5),
    updatedAt: daysAgo(5),
  },
];

// Social features data - will be added when types are defined
export const mockSquads: any[] = [];
export const mockChallenges: any[] = [];

// Helper function to get all mock data organized
export const getMockData = () => ({
  user: mockUser,
  focusCategories: mockFocusCategories,
  focusTags: mockFocusTags,
  focusSessions: mockFocusSessions,
  tasks: mockTasks,
  rewardTransactions: mockRewardTransactions,
});

// Helper to initialize store with mock data
export const initializeWithMockData = (store: any) => {
  const mockData = getMockData();
  
  // Set auth state
  store.auth.user = mockData.user;
  store.auth.isAuthenticated = true;
  store.auth.authToken = 'mock-auth-token';
  store.auth.isLoading = false;

  // Initialize focus data
  mockData.focusCategories.forEach(category => {
    store.focus.categories.byId[category.id] = category;
    store.focus.categories.allIds.push(category.id);
  });

  mockData.focusTags.forEach(tag => {
    store.focus.tags.byId[tag.id] = tag;
    store.focus.tags.allIds.push(tag.id);
  });

  mockData.focusSessions.forEach(session => {
    store.focus.sessions.byId[session.id] = session;
    store.focus.sessions.allIds.push(session.id);
  });

  // Initialize tasks data
  mockData.tasks.forEach(task => {
    store.tasks.tasks.byId[task.id] = task;
    store.tasks.tasks.allIds.push(task.id);
  });

  // Initialize rewards data
  store.rewards.balance = 2250; // From user stats
  mockData.rewardTransactions.forEach(transaction => {
    store.rewards.transactions.byId[transaction.id] = transaction;
    store.rewards.transactions.allIds.push(transaction.id);
  });

  // Mark store as hydrated
  store.ui.isHydrated = true;

  console.log('🎭 Mock data initialized! Demo user logged in with sample data.');
  console.log('📊 Sample data loaded:');
  console.log(`  - ${mockData.focusCategories.length} focus categories`);
  console.log(`  - ${mockData.focusTags.length} focus tags`);
  console.log(`  - ${mockData.focusSessions.length} focus sessions`);
  console.log(`  - ${mockData.tasks.length} tasks`);
  console.log(`  - ${mockData.rewardTransactions.length} reward transactions`);
  
  return store;
};