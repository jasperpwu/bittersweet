/**
 * Core middleware implementations for unified Zustand store
 * Addresses Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { StoreError, DevtoolsConfig } from '../types';

/**
 * Performance monitoring middleware
 * Tracks state update performance and warns about slow operations
 */
export const performanceMiddleware = <T>(config: any) => (set: any, get: any, api: any) => {
  const originalSet = set;
  
  return config(
    (...args: any[]) => {
      const start = performance.now();
      const result = originalSet(...args);
      const end = performance.now();
      
      const duration = end - start;
      
      // Warn about slow state updates in development
      if (__DEV__ && duration > 16) {
        console.warn(`🐌 Slow state update detected: ${duration.toFixed(2)}ms`);
        console.trace('State update trace');
      }
      
      // Log performance metrics
      if (__DEV__ && duration > 5) {
        console.log(`⚡ State update: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    },
    get,
    api
  );
};

/**
 * Error handling middleware
 * Catches and handles errors during state updates
 */
export const errorHandlingMiddleware = <T extends { ui: { addError: (error: StoreError) => void } }>(
  config: any
) => (set: any, get: any, api: any) => {
  return config(
    (partial: any, replace?: boolean) => {
      try {
        return set(partial, replace);
      } catch (error) {
        const storeError: StoreError = {
          code: 'STATE_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown state update error',
          details: error,
          timestamp: new Date(),
          recoverable: true,
        };
        
        // Log error in development
        if (__DEV__) {
          console.error('🚨 Store Error:', storeError);
          console.trace('Error trace');
        }
        
        // Add error to UI state if available
        try {
          const state = get();
          if (state?.ui?.addError) {
            state.ui.addError(storeError);
          }
        } catch (uiError) {
          console.error('Failed to add error to UI state:', uiError);
        }
        
        // Re-throw the original error
        throw error;
      }
    },
    get,
    api
  );
};

/**
 * Logging middleware for development
 * Logs all state changes in development mode
 */
export const loggingMiddleware = <T>(config: any) => (set: any, get: any, api: any) => {
  if (!__DEV__) {
    return config(set, get, api);
  }

  const originalSet = set;
  
  return config(
    (partial: any, replace?: boolean, action?: string) => {
      const prevState = get();
      const result = originalSet(partial, replace);
      const nextState = get();
      
      // Log state changes
      console.group(`🔄 State Update${action ? ` - ${action}` : ''}`);
      console.log('Previous State:', prevState);
      console.log('Partial Update:', partial);
      console.log('Next State:', nextState);
      console.groupEnd();
      
      return result;
    },
    get,
    api
  );
};

/**
 * Create devtools configuration
 */
export function createDevtoolsConfig(): DevtoolsConfig {
  return {
    name: 'bittersweet-store',
    enabled: __DEV__,
    serialize: {
      options: {
        date: true,
        function: true,
        undefined: true,
      },
    },
    actionSanitizer: (action: any) => {
      // Sanitize sensitive data in development
      return action;
    },
  };
}

/**
 * Create async action helper with error handling
 */
export function createAsyncAction<T, P>(
  actionName: string,
  asyncFn: (params: P) => Promise<T>
) {
  return async (params: P, { set, get }: { set: any; get: any }) => {
    const stateKey = `${actionName}State`;
    
    // Set loading state
    set((state: any) => {
      if (state[stateKey]) {
        state[stateKey].loading = true;
        state[stateKey].error = null;
      }
    });
    
    try {
      const result = await asyncFn(params);
      
      // Set success state
      set((state: any) => {
        if (state[stateKey]) {
          state[stateKey].loading = false;
          state[stateKey].data = result;
          state[stateKey].lastFetch = new Date();
        }
      });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Set error state
      set((state: any) => {
        if (state[stateKey]) {
          state[stateKey].loading = false;
          state[stateKey].error = errorMessage;
        }
      });
      
      throw error;
    }
  };
}

/**
 * Combine all middleware for the store
 */
export function createStoreMiddleware() {
  return {
    devtools: createDevtoolsConfig(),
    performance: performanceMiddleware,
    errorHandling: errorHandlingMiddleware,
    logging: loggingMiddleware,
    immer,
  };
}