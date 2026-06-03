/**
 * Rewards slice with transaction management and app unlock functionality
 * Addresses Requirements: 2.2, 5.1, 5.2, 5.3, 6.2, 7.4, 8.2, 9.1
 */

import { RewardsSlice, UnlockableApp } from '../types';
import { createNormalizedState, updateNormalizedState } from '../utils/entityManager';
import { createEventEmitter, createEventListener, STORE_EVENTS } from '../utils/eventBus';

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

  // Listen for focus session completions to award fruits
  eventListener.on(STORE_EVENTS.FOCUS_SESSION_COMPLETED, (event) => {
    const { fruitsEarned, sessionId, duration } = event.payload;
    if (fruitsEarned > 0) {
      get().rewards.earnFruits(fruitsEarned, 'focus_session', {
        sessionId,
        duration,
      });
    }
  });

  // Listen for task completions to award fruits
  eventListener.on(STORE_EVENTS.TASK_COMPLETED, (event) => {
    const { taskId, focusTime } = event.payload;
    // Award fruits based on focus time (1 fruit per 5 minutes)
    const fruitsToAward = Math.floor(focusTime / 300); // 300 seconds = 5 minutes
    if (fruitsToAward > 0) {
      get().rewards.earnFruits(fruitsToAward, 'task_completion', {
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
    unlockableApps: createNormalizedState<UnlockableApp>(mockUnlockableApps),
    
    // Actions
    earnFruits: (amount: number, source: string, metadata?: any) => {
      set((state: any) => {
        state.rewards.balance += amount;
        state.rewards.totalEarned += amount;
      });

      // Emit event for other stores
      eventEmitter.emitFruitsEarned(amount, source, metadata);
    },

    spendFruits: (amount: number, purpose: string, metadata?: any) => {
      const currentBalance = get().rewards.balance;
      
      if (currentBalance < amount) {
        throw new Error(`Insufficient fruits. Required: ${amount}, Available: ${currentBalance}`);
      }

      set((state: any) => {
        state.rewards.balance -= amount;
        state.rewards.totalSpent += amount;
      });

      // Emit event
      eventEmitter.emit(STORE_EVENTS.FRUITS_SPENT, {
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
        throw new Error(`Insufficient fruits to unlock ${app.name}. Required: ${app.cost}, Available: ${currentBalance}`);
      }

      try {
        // Spend fruits for app unlock
        get().rewards.spendFruits(app.cost, 'app_unlock', {
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