/**
 * Rewards slice with transaction management and app unlock functionality
 * Addresses Requirements: 2.2, 5.1, 5.2, 5.3, 6.2, 7.4, 8.2, 9.1
 */

import { RewardsSlice, RewardTransaction, UnlockableApp } from '../types';
import { createNormalizedState, updateNormalizedState } from '../utils/entityManager';
import { createEventEmitter, createEventListener, STORE_EVENTS } from '../utils/eventBus';

// Simple ID generator to avoid import issues
const generateId = () => {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${randomStr}`;
};

// Mock data for unlockable apps
const mockUnlockableApps: UnlockableApp[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    bundleId: 'com.burbn.instagram',
    icon: '📷',
    cost: 50,
    isUnlocked: false,
    tagId: 'Social',
    description: 'Photo and video sharing',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    bundleId: 'com.zhiliaoapp.musically',
    icon: '🎵',
    cost: 75,
    isUnlocked: false,
    tagId: 'Entertainment',
    description: 'Short-form video content',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'youtube',
    name: 'YouTube',
    bundleId: 'com.google.ios.youtube',
    icon: '📺',
    cost: 100,
    isUnlocked: false,
    tagId: 'Entertainment',
    description: 'Video streaming platform',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'twitter',
    name: 'Twitter',
    bundleId: 'com.atebits.Tweetie2',
    icon: '🐦',
    cost: 60,
    isUnlocked: false,
    tagId: 'Social',
    description: 'Social networking',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export function createRewardsSlice(set: any, get: any, api: any): RewardsSlice {
  const eventEmitter = createEventEmitter('rewards');
  const eventListener = createEventListener();

  // Listen for focus session completions to award seeds
  eventListener.on(STORE_EVENTS.FOCUS_SESSION_COMPLETED, (event) => {
    const { seedsEarned, sessionId, duration } = event.payload;
    if (seedsEarned > 0) {
      get().rewards.earnSeeds(seedsEarned, 'focus_session', {
        sessionId,
        duration,
      });
    }
  });

  // Listen for task completions to award seeds
  eventListener.on(STORE_EVENTS.TASK_COMPLETED, (event) => {
    const { taskId, focusTime } = event.payload;
    // Award seeds based on focus time (1 seed per minute)
    const seedsToAward = Math.floor(focusTime / 60);
    if (seedsToAward > 0) {
      get().rewards.earnSeeds(seedsToAward, 'task_completion', {
        taskId,
        focusTime,
      });
    }
  });

  return {
    // State
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    transactions: createNormalizedState<RewardTransaction>(),
    unlockableApps: createNormalizedState<UnlockableApp>(mockUnlockableApps),
    
    // Actions
    earnSeeds: (amount: number, source: string, metadata?: any) => {
      set((state: any) => {
        // Create transaction record
        const transaction: RewardTransaction = {
          id: generateId(),
          userId: 'anonymous',
          amount,
          type: 'earned',
          source,
          description: `Earned ${amount} seeds from ${source}`,
          metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Update balance and totals
        state.rewards.balance += amount;
        state.rewards.totalEarned += amount;

        // Add transaction to history
        state.rewards.transactions = updateNormalizedState(
          state.rewards.transactions,
          (manager) => manager.add(transaction)
        );
      });

      // Emit event for other stores
      eventEmitter.emitSeedsEarned(amount, source, metadata);
    },

    spendSeeds: (amount: number, purpose: string, metadata?: any) => {
      const currentBalance = get().rewards.balance;
      
      if (currentBalance < amount) {
        throw new Error(`Insufficient seeds. Required: ${amount}, Available: ${currentBalance}`);
      }

      set((state: any) => {
        // Create transaction record
        const transaction: RewardTransaction = {
          id: generateId(),
          userId: 'anonymous',
          amount,
          type: 'spent',
          source: purpose,
          description: `Spent ${amount} seeds on ${purpose}`,
          metadata,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Update balance and totals
        state.rewards.balance -= amount;
        state.rewards.totalSpent += amount;

        // Add transaction to history
        state.rewards.transactions = updateNormalizedState(
          state.rewards.transactions,
          (manager) => manager.add(transaction)
        );
      });

      // Emit event
      eventEmitter.emit(STORE_EVENTS.SEEDS_SPENT, {
        amount,
        purpose,
        metadata,
      });
    },

    unlockApp: async (appId: string): Promise<boolean> => {
      const app = get().rewards.unlockableApps.byId[appId];
      
      if (!app) {
        throw new Error(`App with ID ${appId} not found`);
      }

      if (app.isUnlocked) {
        throw new Error(`App ${app.name} is already unlocked`);
      }

      const currentBalance = get().rewards.balance;
      if (currentBalance < app.cost) {
        throw new Error(`Insufficient seeds to unlock ${app.name}. Required: ${app.cost}, Available: ${currentBalance}`);
      }

      try {
        // Spend seeds for app unlock
        get().rewards.spendSeeds(app.cost, 'app_unlock', {
          appId,
          appName: app.name,
          bundleId: app.bundleId,
        });

        // Mark app as unlocked
        set((state: any) => {
          state.rewards.unlockableApps = updateNormalizedState(
            state.rewards.unlockableApps,
            (manager) => manager.update(appId, { isUnlocked: true } as any)
          );
        });

        // Emit event
        eventEmitter.emit(STORE_EVENTS.APP_UNLOCKED, {
          appId,
          appName: app.name,
          cost: app.cost,
        });

        return true;
      } catch (error) {
        console.error('Failed to unlock app:', error);
        return false;
      }
    },
    
    // Selectors
    getBalance: () => get().rewards.balance,
    
    getTransactionHistory: () => {
      const transactions = get().rewards.transactions;
      return transactions.allIds
        .map((id: string) => transactions.byId[id])
        .filter(Boolean)
        .sort((a: RewardTransaction, b: RewardTransaction) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    
    getUnlockableApps: () => {
      const apps = get().rewards.unlockableApps;
      return apps.allIds
        .map((id: string) => apps.byId[id])
        .filter(Boolean)
        .sort((a: UnlockableApp, b: UnlockableApp) => a.cost - b.cost);
    },
    
    canAfford: (amount: number) => get().rewards.balance >= amount,
  };
}