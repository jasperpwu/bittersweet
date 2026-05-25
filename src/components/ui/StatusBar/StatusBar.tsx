import React, { FC } from 'react';
import { StatusBar as RNStatusBar, Platform, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface StatusBarProps {
  variant?: 'light' | 'dark' | 'auto';
  backgroundColor?: string;
}

export const StatusBar: FC<StatusBarProps> = ({
  variant = 'auto',
  backgroundColor,
}) => {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();

  const resolvedVariant = variant === 'auto' ? (colorScheme === 'dark' ? 'dark' : 'light') : variant;
  const defaultBg = colorScheme === 'dark' ? '#1B1C30' : '#F5E6D3';

  return (
    <>
      <RNStatusBar
        barStyle={resolvedVariant === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={Platform.OS === 'android' ? (backgroundColor ?? defaultBg) : 'transparent'}
        translucent={Platform.OS === 'android'}
      />
    </>
  );
};