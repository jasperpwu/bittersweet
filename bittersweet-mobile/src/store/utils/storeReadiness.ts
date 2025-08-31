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
      hasUI: !!state?.ui,
      hasSettings: !!state?.settings,
    });
    
    // Check if all essential slices are available
    const requiredSlices = ['focus', 'ui', 'settings'];
    const hasAllSlices = requiredSlices.every(slice => !!state?.[slice as keyof typeof state]);
    
    // Check if focus slice has essential methods (sessions are the primary focus entity)
    const hasFocusMethods = !!(
      typeof state?.focus?.createSession === 'function' &&
      typeof state?.focus?.updateSession === 'function' &&
      typeof state?.focus?.deleteSession === 'function'
    );
    
    const isReady = hasAllSlices && hasFocusMethods;
    
    console.log('🔍 Store readiness result:', {
      hasAllSlices,
      hasFocusMethods,
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