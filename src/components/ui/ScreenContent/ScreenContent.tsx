import React, { FC, ReactNode } from 'react';
import { View, SafeAreaView } from 'react-native';

interface ScreenContentProps {
  children: ReactNode;
  className?: string;
}

export const ScreenContent: FC<ScreenContentProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <SafeAreaView className={`flex-1 ${className}`}>
      <View className="flex-1 m-6">
        {children}
      </View>
    </SafeAreaView>
  );
};