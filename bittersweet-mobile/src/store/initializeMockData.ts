/**
 * Initialize store with mock data for development and testing
 */

import { useAppStore } from './index';
import { getMockData } from './mockData';

/**
 * Initializes the store with comprehensive mock data
 * Call this function to populate the store with a test user and sample data
 */
export const initializeStoreWithMockData = () => {
  const mockData = getMockData();
  const store = useAppStore.getState();

  try {
    console.log('🎭 Initializing store with mock data...');
    console.log('👤 Mock user:', mockData.user?.name || 'UNDEFINED');
    console.log('📊 Mock data keys:', Object.keys(mockData));

    // Initialize focus data
    const focusUpdates: any = {
      sessions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: new Date() },
      categories: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: new Date() },
      tags: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: new Date() },
      currentSession: {
        isRunning: false,
        session: null,
        startTime: null,
        elapsedTime: 0,
        remainingTime: 0,
        isPaused: false,
      },
    };

    // Add categories
    console.log('🏷️  Adding categories:', mockData.focusCategories?.length || 0);
    if (mockData.focusCategories) {
      mockData.focusCategories.forEach(category => {
        focusUpdates.categories.byId[category.id] = category;
        focusUpdates.categories.allIds.push(category.id);
      });
    }

    // Add tags
    console.log('🔖 Adding tags:', mockData.focusTags?.length || 0);
    if (mockData.focusTags) {
      mockData.focusTags.forEach(tag => {
        focusUpdates.tags.byId[tag.id] = tag;
        focusUpdates.tags.allIds.push(tag.id);
      });
    }

    // Add sessions
    console.log('⏱️  Adding sessions:', mockData.focusSessions?.length || 0);
    if (mockData.focusSessions) {
      mockData.focusSessions.forEach(session => {
        focusUpdates.sessions.byId[session.id] = session;
        focusUpdates.sessions.allIds.push(session.id);
      });
    }

    useAppStore.setState((state) => ({
      focus: {
        ...state.focus,
        ...focusUpdates,
      },
    }));

    // Initialize tasks data
    const tasksUpdates: any = {
      tasks: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: new Date() },
      selectedDate: new Date(),
      viewMode: 'day' as const,
    };

    console.log('📋 Adding tasks:', mockData.tasks?.length || 0);
    if (mockData.tasks) {
      mockData.tasks.forEach(task => {
        tasksUpdates.tasks.byId[task.id] = task;
        tasksUpdates.tasks.allIds.push(task.id);
      });
    }

    useAppStore.setState((state) => ({
      tasks: {
        ...state.tasks,
        ...tasksUpdates,
      },
    }));

    // Initialize rewards data
    const rewardsUpdates: any = {
      balance: mockData.user.stats.seedsEarned,
      totalEarned: mockData.user.stats.seedsEarned + 500, // Add some spent amount
      totalSpent: 500,
      transactions: { byId: {}, allIds: [], loading: false, error: null, lastUpdated: new Date() },
      unlockedApps: [
        { id: 'instagram', name: 'Instagram', icon: 'logo-instagram', unlockedAt: new Date() },
        { id: 'twitter', name: 'Twitter', icon: 'logo-twitter', unlockedAt: new Date() },
      ],
    };

    console.log('🎁 Adding reward transactions:', mockData.rewardTransactions?.length || 0);
    if (mockData.rewardTransactions) {
      mockData.rewardTransactions.forEach(transaction => {
        rewardsUpdates.transactions.byId[transaction.id] = transaction;
        rewardsUpdates.transactions.allIds.push(transaction.id);
      });
    }

    useAppStore.setState((state) => ({
      rewards: {
        ...state.rewards,
        ...rewardsUpdates,
      },
    }));

    // Settings and UI state will be handled by the store's natural initialization

    console.log('✅ Mock data initialization completed!');
    console.log('🎭 Demo user:', mockData.user.name, `(${mockData.user.email})`);
    console.log('📊 Sample data loaded:');
    console.log(`  - ${mockData.focusCategories.length} focus categories`);
    console.log(`  - ${mockData.focusTags.length} focus tags`);
    console.log(`  - ${mockData.focusSessions.length} focus sessions`);
    console.log(`  - ${mockData.tasks.length} tasks`);
    console.log(`  - ${mockData.rewardTransactions.length} reward transactions`);
    console.log('🌱 Current balance:', rewardsUpdates.balance, 'seeds');

    return true;
  } catch (error) {
    console.error('❌ Failed to initialize mock data:', error);
    return false;
  }
};

/**
 * Check if the store should be initialized with mock data
 * This can be controlled via environment variables or other flags
 */
export const shouldInitializeMockData = (): boolean => {
  // Check if we're in development and want mock data
  if (process.env.NODE_ENV === 'development') {
    // You can add more sophisticated logic here, e.g.:
    // - Check AsyncStorage for a flag
    // - Check environment variables
    // - Check if user is already logged in
    const store = useAppStore.getState();
    return true;
  }
  
  return false;
};

/**
 * Auto-initialize mock data if conditions are met
 */
export const autoInitializeMockData = () => {
  if (shouldInitializeMockData()) {
    setTimeout(() => {
      initializeStoreWithMockData();
    }, 1000); // Small delay to ensure store is fully initialized
  }
};