/**
 * Store initialization check utility
 */

import { useAppStore } from './index';

export function checkStoreInitialization() {
  try {
    const store = useAppStore.getState();
    
    const checks = {
      focus: !!store.focus,
      tasks: !!store.tasks,
      rewards: !!store.rewards,
      settings: !!store.settings,
      ui: !!store.ui,
    };
    
    const allInitialized = Object.values(checks).every(Boolean);
    
    if (__DEV__) {
      console.log('Store initialization check:', {
        ...checks,
        allInitialized,
      });
      
      if (store.tasks) {
        console.log('Tasks slice methods:', {
          getTasksForDate: typeof store.tasks.getTasksForDate,
          getTaskById: typeof store.tasks.getTaskById,
          createTask: typeof store.tasks.createTask,
        });
      }
    }
    
    return allInitialized;
  } catch (error) {
    console.error('Store initialization check failed:', error);
    return false;
  }
}

export function waitForStoreInitialization(timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const check = () => {
      if (checkStoreInitialization()) {
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        console.warn('Store initialization timeout');
        resolve(false);
        return;
      }
      
      setTimeout(check, 100);
    };
    
    check();
  });
}