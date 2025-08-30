/**
 * Store readiness utilities
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../index';

export function isStoreReady(): boolean {
  try {
    const state = useAppStore.getState();
    
    console.log('🔍 Checking store readiness:', {
      hasState: !!state,
      hasFocus: !!state?.focus,
      hasTasks: !!state?.tasks,
      hasUI: !!state?.ui,
      hasCreateTask: !!state?.tasks?.createTask,
      createTaskType: typeof state?.tasks?.createTask,
    });
    
    // Check if all essential slices are available
    const requiredSlices = ['focus', 'tasks', 'ui'];
    const hasAllSlices = requiredSlices.every(slice => !!state?.[slice as keyof typeof state]);
    
    // Check if tasks slice has essential methods
    const hasTaskMethods = !!(
      state?.tasks?.createTask &&
      state?.tasks?.updateTask &&
      state?.tasks?.deleteTask &&
      state?.tasks?.setSelectedDate
    );
    
    const isReady = hasAllSlices && hasTaskMethods;
    
    console.log('🔍 Store readiness result:', {
      hasAllSlices,
      hasTaskMethods,
      isReady,
      missingSlices: requiredSlices.filter(slice => !state?.[slice as keyof typeof state]),
    });
    
    return isReady;
  } catch (error) {
    console.error('Error checking store readiness:', error);
    return false;
  }
}

export function waitForStore(timeout: number = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const check = () => {
      if (isStoreReady()) {
        console.log('✅ Store is ready!');
        resolve(true);
        return;
      }
      
      if (Date.now() - startTime > timeout) {
        console.warn('Store readiness timeout');
        resolve(false);
        return;
      }
      
      setTimeout(check, 50);
    };
    
    check();
  });
}

export function useStoreReadiness() {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    console.log('🔍 useStoreReadiness: Starting check...');
    waitForStore().then((ready) => {
      console.log('🔍 useStoreReadiness: Result:', ready);
      setIsReady(ready);
    });
  }, []);
  
  return isReady;
}