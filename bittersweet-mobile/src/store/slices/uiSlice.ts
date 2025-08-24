/**
 * UI slice implementation
 * Addresses Requirements: 7.4, 8.2, 9.1
 */

import { UISlice, StoreError, ModalState, LoadingState } from '../types';

export function createUISlice(set: any, get: any, api: any): UISlice {
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
    },
    
    hideModal: (type: string) => {
      set((state: any) => {
        if (state.ui.modals[type]) {
          state.ui.modals[type].isVisible = false;
        }
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
        state.ui.errors.push(error);
        
        // Limit error history to prevent memory leaks
        if (state.ui.errors.length > 50) {
          state.ui.errors = state.ui.errors.slice(-25);
        }
      });
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