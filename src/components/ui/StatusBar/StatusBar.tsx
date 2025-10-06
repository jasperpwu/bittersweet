import React, { FC } from 'react';
import { StatusBar as RNStatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StatusBarProps {
  variant?: 'light' | 'dark';
  backgroundColor?: string;
}

export const StatusBar: FC<StatusBarProps> = ({
  variant = 'dark',
  backgroundColor = '#1B1C30',
}) => {
  const insets = useSafeAreaInsets();

  return (
    <>
      <RNStatusBar
        barStyle={variant === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={Platform.OS === 'android' ? backgroundColor : 'transparent'}
        translucent={Platform.OS === 'android'}
      />
    </>
  );
};