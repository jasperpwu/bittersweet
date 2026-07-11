import React, { FC } from 'react';
import { StatusBar as RNStatusBar, Platform, useColorScheme } from 'react-native';
import { colors } from '../../../config/theme';
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
  const defaultBg = colorScheme === 'dark' ? colors.dark.background : colors.light.screen;

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