/**
 * UI slice for application state, modals, and loading indicators
 * Addresses Requirements: 2.2, 5.1, 5.2, 5.3, 6.2, 7.4, 8.2, 9.1
 */

import { UISlice, StoreError, ModalState, LoadingState } from '../types';
import { createEventEmitter, createEventListener, STORE_EVENTS } from '../utils/eventBus';

// Common modal types
export const MODAL_TYPES = {
  TASK_CREATION: 'task_creation',
  TAG_SELECTION: 'tag_selection',
  SESSION_COMPLETE: 'session_complete',
  APP_UNLOCK_CONFIRM: 'app_unlock_confirm',
  SETTINGS: 'settings',
  PROFILE: 'profile',
  ERROR: 'error',
  CONFIRMATION: 'confirmation',
} as const;

// Common loading actions
export const LOADING_ACTIONS = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  PROFILE_UPDATE: 'profile_update',
  SESSION_START: 'session_start',
  SESSION_COMPLETE: 'session_complete',
  TASK_CREATE: 'task_create',
  TASK_UPDATE: 'task_update',
  APP_UNLOCK: 'app_unlock',
  SETTINGS_UPDATE: 'settings_update',
} as const;

export function createUISlice(set: any, get: any, api: any): UISlice {
  const eventEmitter = createEventEmitter('ui');
  const eventListener = createEventListener();

  // Listen for various events to show appropriate modals or loading states
  eventListener.on(STORE_EVENTS.FOCUS_SESSION_COMPLETED, (event) => {
    const { sessionId, seedsEarned, duration } = event.payload;
    get().ui.showModal(MODAL_TYPES.SESSION_COMPLETE, {
      sessionId,
      seedsEarned,
      duration,
    });
  });

  eventListener.on(STORE_EVENTS.APP_UNLOCKED, (event) => {
    const { appName, cost } = event.payload;
    get().ui.showModal(MODAL_TYPES.CONFIRMATION, {
      title: 'App Unlocked!',
      message: `${appName} has been unlocked for ${cost} seeds.`,
      type: 'success',
    });
  });

  eventListener.on(STORE_EVENTS.ERROR_OCCURRED, (event) => {
    const error = event.payload;
    get().ui.addError(error);
    
    // Show error modal for critical errors
    if (!error.recoverable) {
      get().ui.showModal(MODAL_TYPES.ERROR, {
        error,
      });
    }
  });

  return {
    // State
    isHydrated: false,
    modals: {},
    loading: {
      global: false,
      actions: {},
    },
    errors: [],
    
    // Actions
    showModal: (type: string, data?: any) => {
      set((state: any) => {
        state.ui.modals[type] = {
          isVisible: true,
          type,
          data,
        };
      });

      // Emit modal opened event
      eventEmitter.emit(STORE_EVENTS.MODAL_OPENED, {
        modalType: type,
        data,
      });
    },
    
    hideModal: (type: string) => {
      set((state: any) => {
        if (state.ui.modals[type]) {
          state.ui.modals[type].isVisible = false;
          // Keep data for potential re-opening, but mark as not visible
        }
      });

      // Emit modal closed event
      eventEmitter.emit(STORE_EVENTS.MODAL_CLOSED, {
        modalType: type,
      });
    },
    
    setLoading: (action: string, loading: boolean) => {
      set((state: any) => {
        if (action === 'global') {
          state.ui.loading.global = loading;
        } else {
          state.ui.loading.actions[action] = loading;
        }
      });
    },
    
    addError: (error: StoreError) => {
      set((state: any) => {
        // Add timestamp if not present
        const errorWithTimestamp = {
          ...error,
          timestamp: error.timestamp || new Date(),
        };
        
        state.ui.errors.push(errorWithTimestamp);
        
        // Limit error history to prevent memory leaks
        if (state.ui.errors.length > 50) {
          state.ui.errors = state.ui.errors.slice(-25);
        }
      });

      // Emit error event
      eventEmitter.emit(STORE_EVENTS.ERROR_OCCURRED, error);
    },
    
    clearError: (errorId: string) => {
      set((state: any) => {
        state.ui.errors = state.ui.errors.filter(
          (error: StoreError) => error.code !== errorId
        );
      });
    },
    
    clearAllErrors: () => {
      set((state: any) => {
        state.ui.errors = [];
      });
    },
    
    // Selectors
    isModalVisible: (type: string) => {
      const modal = get().ui.modals[type];
      return modal?.isVisible || false;
    },
    
    getModalData: (type: string) => {
      const modal = get().ui.modals[type];
      return modal?.data;
    },
    
    isLoading: (action?: string) => {
      const loadingState = get().ui.loading;
      if (action) {
        return loadingState.actions[action] || false;
      }
      return loadingState.global;
    },
    
    getErrors: () => get().ui.errors,
  };
}