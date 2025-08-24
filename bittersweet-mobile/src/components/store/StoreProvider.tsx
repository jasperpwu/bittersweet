/**
 * Store Provider component to ensure proper store initialization
 * Addresses Requirements: 8.1, 8.4, 8.5, 10.4, 10.5
 */

import React, { FC, ReactNode, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useAppStore, useUI } from '../../store';

interface StoreProviderProps {
  children: ReactNode;
}

export const StoreProvider: FC<StoreProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const ui = useUI();

  useEffect(() => {
    const initializeStore = async () => {
      try {
        // Wait for store to be hydrated
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        while (!ui.isHydrated && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        // Verify store slices are properly initialized
        const state = useAppStore.getState();
        
        if (!state.auth) {
          throw new Error('Auth slice not initialized');
        }
        
        if (!state.tasks) {
          throw new Error('Tasks slice not initialized');
        }
        
        if (!state.focus) {
          throw new Error('Focus slice not initialized');
        }
        
        if (!state.rewards) {
          throw new Error('Rewards slice not initialized');
        }
        
        if (!state.social) {
          throw new Error('Social slice not initialized');
        }
        
        if (!state.settings) {
          throw new Error('Settings slice not initialized');
        }
        
        if (!state.ui) {
          throw new Error('UI slice not initialized');
        }
        
        // Verify critical functions exist
        if (typeof state.tasks.setSelectedDate !== 'function') {
          throw new Error('Tasks setSelectedDate function not available');
        }
        
        console.log('✅ Store initialization verified');
        setIsInitialized(true);
        
      } catch (error) {
        console.error('❌ Store initialization failed:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    initializeStore();
  }, [ui.isHydrated]);

  if (initError) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#1B1C30',
        padding: 20 
      }}>
        <Text style={{ color: '#EF786C', fontSize: 18, marginBottom: 10 }}>
          Store Initialization Error
        </Text>
        <Text style={{ color: '#CACACA', textAlign: 'center' }}>
          {initError}
        </Text>
        <Text style={{ color: '#8A8A8A', textAlign: 'center', marginTop: 10, fontSize: 12 }}>
          Please restart the app. If the problem persists, try clearing app data.
        </Text>
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#1B1C30' 
      }}>
        <ActivityIndicator size="large" color="#6592E9" />
        <Text style={{ color: '#CACACA', marginTop: 16 }}>
          Initializing store...
        </Text>
      </View>
    );
  }

  return <>{children}</>;
};