/**
 * Store Event Bus for cross-store communication
 * Addresses Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { StoreEvent, RootStore } from '../types';

export class StoreEventBus {
  private listeners: Map<string, Array<(event: StoreEvent) => void>> = new Map();
  private eventHistory: StoreEvent[] = [];
  private maxHistorySize = 100;

  /**
   * Emit an event to all registered listeners
   */
  emit(event: StoreEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Notify listeners
    const handlers = this.listeners.get(event.type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${event.type}:`, error);
      }
    });

    // Also notify wildcard listeners
    const wildcardHandlers = this.listeners.get('*') || [];
    wildcardHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in wildcard event handler:`, error);
      }
    });
  }

  /**
   * Register an event listener
   */
  on(eventType: string, handler: (event: StoreEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.listeners.get(eventType) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  /**
   * Register a one-time event listener
   */
  once(eventType: string, handler: (event: StoreEvent) => void): () => void {
    const unsubscribe = this.on(eventType, (event) => {
      handler(event);
      unsubscribe();
    });
    return unsubscribe;
  }

  /**
   * Remove all listeners for an event type
   */
  off(eventType: string): void {
    this.listeners.delete(eventType);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }

  /**
   * Get event history
   */
  getEventHistory(): StoreEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get listeners count for debugging
   */
  getListenersCount(eventType?: string): number {
    if (eventType) {
      return this.listeners.get(eventType)?.length || 0;
    }
    return Array.from(this.listeners.values()).reduce((total, handlers) => total + handlers.length, 0);
  }
}

// Global event bus instance
export const storeEventBus = new StoreEventBus();

// Event type constants
export const STORE_EVENTS = {
  // Auth events
  USER_LOGGED_IN: 'USER_LOGGED_IN',
  USER_LOGGED_OUT: 'USER_LOGGED_OUT',
  USER_PROFILE_UPDATED: 'USER_PROFILE_UPDATED',

  // Focus session events
  FOCUS_SESSION_STARTED: 'FOCUS_SESSION_STARTED',
  FOCUS_SESSION_PAUSED: 'FOCUS_SESSION_PAUSED',
  FOCUS_SESSION_RESUMED: 'FOCUS_SESSION_RESUMED',
  FOCUS_SESSION_COMPLETED: 'FOCUS_SESSION_COMPLETED',
  FOCUS_SESSION_CANCELLED: 'FOCUS_SESSION_CANCELLED',

  // Task events
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_DELETED: 'TASK_DELETED',
  TASK_STARTED: 'TASK_STARTED',

  // Reward events
  SEEDS_EARNED: 'SEEDS_EARNED',
  SEEDS_SPENT: 'SEEDS_SPENT',
  APP_UNLOCKED: 'APP_UNLOCKED',

  // Social events
  SQUAD_JOINED: 'SQUAD_JOINED',
  SQUAD_LEFT: 'SQUAD_LEFT',
  CHALLENGE_JOINED: 'CHALLENGE_JOINED',
  CHALLENGE_COMPLETED: 'CHALLENGE_COMPLETED',

  // Settings events
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  THEME_CHANGED: 'THEME_CHANGED',

  // UI events
  MODAL_OPENED: 'MODAL_OPENED',
  MODAL_CLOSED: 'MODAL_CLOSED',
  ERROR_OCCURRED: 'ERROR_OCCURRED',
} as const;

/**
 * Helper function to create typed events
 */
export function createStoreEvent<T = any>(
  type: string,
  payload: T,
  source: keyof RootStore
): StoreEvent {
  return {
    type,
    payload,
    source,
    timestamp: new Date()
  };
}

/**
 * Event emitter helper for store slices
 */
export function createEventEmitter(source: keyof RootStore) {
  return {
    emit: <T = any>(type: string, payload: T) => {
      storeEventBus.emit(createStoreEvent(type, payload, source));
    },
    
    emitUserLoggedIn: (user: any) => {
      storeEventBus.emit(createStoreEvent(STORE_EVENTS.USER_LOGGED_IN, { user }, source));
    },
    
    emitUserLoggedOut: () => {
      storeEventBus.emit(createStoreEvent(STORE_EVENTS.USER_LOGGED_OUT, {}, source));
    },
    
    emitFocusSessionCompleted: (sessionId: string, seedsEarned: number, duration: number) => {
      storeEventBus.emit(createStoreEvent(STORE_EVENTS.FOCUS_SESSION_COMPLETED, {
        sessionId,
        seedsEarned,
        duration
      }, source));
    },
    
    emitTaskCompleted: (taskId: string, focusTime: number) => {
      storeEventBus.emit(createStoreEvent(STORE_EVENTS.TASK_COMPLETED, {
        taskId,
        focusTime
      }, source));
    },
    
    emitSeedsEarned: (amount: number, seedSource: string, metadata?: any) => {
      storeEventBus.emit(createStoreEvent(STORE_EVENTS.SEEDS_EARNED, {
        amount,
        source: seedSource,
        metadata
      }, source));
    }
  };
}

/**
 * Event listener helper for store slices
 */
export function createEventListener() {
  const subscriptions: Array<() => void> = [];

  return {
    on: (eventType: string, handler: (event: StoreEvent) => void) => {
      const unsubscribe = storeEventBus.on(eventType, handler);
      subscriptions.push(unsubscribe);
      return unsubscribe;
    },
    
    once: (eventType: string, handler: (event: StoreEvent) => void) => {
      const unsubscribe = storeEventBus.once(eventType, handler);
      subscriptions.push(unsubscribe);
      return unsubscribe;
    },
    
    cleanup: () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
      subscriptions.length = 0;
    }
  };
}