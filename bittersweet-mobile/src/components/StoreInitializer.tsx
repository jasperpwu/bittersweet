/**
 * Store Initializer Component
 * Ensures the store is properly initialized before rendering children
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { checkStoreInitialization, waitForStoreInitialization } from '../store/init-check';

interface StoreInitializerProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function StoreInitializer({ children, fallback }: StoreInitializerProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeStore = async () => {
      try {
        // Check if store is already initialized
        if (checkStoreInitialization()) {
          setIsInitialized(true);
          setIsLoading(false);
          return;
        }

        // Wait for store to initialize
        const initialized = await waitForStoreInitialization();
        setIsInitialized(initialized);
        setIsLoading(false);

        if (!initialized) {
          console.error('Store failed to initialize within timeout');
        }
      } catch (error) {
        console.error('Store initialization error:', error);
        setIsLoading(false);
      }
    };

    initializeStore();
  }, []);

  if (isLoading) {
    return fallback || (
      <View className="flex-1 justify-center items-center bg-dark-bg">
        <ActivityIndicator size="large" color="#6592E9" />
        <Text className="text-dark-text-primary mt-4">Initializing...</Text>
      </View>
    );
  }

  if (!isInitialized) {
    return (
      <View className="flex-1 justify-center items-center bg-dark-bg">
        <Text className="text-error text-center px-4">
          Store initialization failed. Please restart the app.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}